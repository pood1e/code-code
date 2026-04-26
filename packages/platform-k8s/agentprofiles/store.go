package agentprofiles

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"code-code.internal/go-contract/domainerror"
	agentprofilev1 "code-code.internal/go-contract/platform/agent_profile/v1"
	statepostgres "code-code.internal/platform-k8s/state/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/encoding/protojson"
)

const postgresProfileTable = "platform_profiles"

type ProfileStore interface {
	List(context.Context) ([]*ProfileState, error)
	Get(context.Context, string) (*ProfileState, error)
	Create(context.Context, *agentprofilev1.AgentProfile) (*ProfileState, error)
	Update(context.Context, string, *agentprofilev1.AgentProfile) (*ProfileState, error)
	Delete(context.Context, string) error
}

type PostgresProfileStore struct {
	repository *statepostgres.JSONRepository
}

func NewPostgresProfileStore(pool *pgxpool.Pool) (*PostgresProfileStore, error) {
	repository, err := statepostgres.NewJSONRepository(pool, postgresProfileTable)
	if err != nil {
		return nil, err
	}
	return &PostgresProfileStore{repository: repository}, nil
}

func (s *PostgresProfileStore) List(ctx context.Context) ([]*ProfileState, error) {
	records, err := s.repository.List(ctx)
	if err != nil {
		return nil, err
	}
	states := make([]*ProfileState, 0, len(records))
	for _, record := range records {
		profile, err := unmarshalStoredProfile(record.ID, record.Payload)
		if err != nil {
			return nil, err
		}
		states = append(states, &ProfileState{Profile: profile, Generation: record.Generation})
	}
	return states, nil
}

func (s *PostgresProfileStore) Get(ctx context.Context, profileID string) (*ProfileState, error) {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return nil, validation("profile id is empty")
	}
	payload, generation, err := s.repository.Get(ctx, profileID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, profileNotFound(profileID)
		}
		return nil, err
	}
	profile, err := unmarshalStoredProfile(profileID, payload)
	if err != nil {
		return nil, err
	}
	return &ProfileState{Profile: profile, Generation: generation}, nil
}

func (s *PostgresProfileStore) Create(ctx context.Context, profile *agentprofilev1.AgentProfile) (*ProfileState, error) {
	payload, profileID, err := marshalStoredProfile(profile)
	if err != nil {
		return nil, err
	}
	generation, err := s.repository.Insert(ctx, profileID, payload)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, alreadyExists(profileID)
		}
		return nil, err
	}
	return &ProfileState{Profile: profile, Generation: generation}, nil
}

func (s *PostgresProfileStore) Update(ctx context.Context, profileID string, profile *agentprofilev1.AgentProfile) (*ProfileState, error) {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return nil, validation("profile id is empty")
	}
	payload, storedID, err := marshalStoredProfile(profile)
	if err != nil {
		return nil, err
	}
	if storedID != profileID {
		return nil, validationf("profile id %q does not match requested id %q", storedID, profileID)
	}
	generation, err := s.repository.Update(ctx, profileID, payload)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, profileNotFound(profileID)
		}
		return nil, err
	}
	return &ProfileState{Profile: profile, Generation: generation}, nil
}

func (s *PostgresProfileStore) Delete(ctx context.Context, profileID string) error {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return validation("profile id is empty")
	}
	return s.repository.Delete(ctx, profileID)
}

func marshalStoredProfile(profile *agentprofilev1.AgentProfile) ([]byte, string, error) {
	if profile == nil {
		return nil, "", validation("profile is nil")
	}
	profileID := strings.TrimSpace(profile.GetProfileId())
	if profileID == "" {
		return nil, "", validation("profile id is empty")
	}
	payload, err := protojson.MarshalOptions{EmitUnpopulated: false}.Marshal(profile)
	if err != nil {
		return nil, "", fmt.Errorf("platformk8s/agentprofiles: marshal profile %q: %w", profileID, err)
	}
	return payload, profileID, nil
}

func unmarshalStoredProfile(profileID string, payload []byte) (*agentprofilev1.AgentProfile, error) {
	profileID = strings.TrimSpace(profileID)
	profile := &agentprofilev1.AgentProfile{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(payload, profile); err != nil {
		return nil, fmt.Errorf("platformk8s/agentprofiles: unmarshal profile %q: %w", profileID, err)
	}
	if profile.GetProfileId() == "" {
		profile.ProfileId = profileID
	}
	if profile.GetProfileId() != profileID {
		return nil, validationf("profile id %q does not match stored id %q", profile.GetProfileId(), profileID)
	}
	return profile, nil
}

func profileNotFound(profileID string) error {
	return domainerror.NewNotFound("platformk8s/agentprofiles: profile %q not found", profileID)
}
