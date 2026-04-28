package skills

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"code-code.internal/go-contract/domainerror"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
	statepostgres "code-code.internal/platform-k8s/internal/platform/state/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/encoding/protojson"
)

const postgresSkillTable = "platform_skills"

type Store interface {
	List(context.Context) ([]*Skill, error)
	Load(context.Context, string) (*Skill, error)
	Create(context.Context, *Skill) error
	Update(context.Context, *Skill) error
	Delete(context.Context, string) error
}

type Repository struct {
	resources *statepostgres.JSONRepository
}

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	resources, err := statepostgres.NewJSONRepository(pool, postgresSkillTable)
	if err != nil {
		return nil, err
	}
	return &Repository{resources: resources}, nil
}

func (r *Repository) List(ctx context.Context) ([]*Skill, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/skills: repository is not initialized")
	}
	records, err := r.resources.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]*Skill, 0, len(records))
	for _, record := range records {
		skill, err := unmarshalSkill(record.ID, record.Payload)
		if err != nil {
			return nil, err
		}
		items = append(items, skill)
	}
	return items, nil
}

func (r *Repository) Load(ctx context.Context, skillID string) (*Skill, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/skills: repository is not initialized")
	}
	skillID = strings.TrimSpace(skillID)
	if skillID == "" {
		return nil, domainerror.NewValidation("platformk8s/skills: skill id is empty")
	}
	payload, _, err := r.resources.Get(ctx, skillID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, skillNotFound(skillID)
		}
		return nil, err
	}
	return unmarshalSkill(skillID, payload)
}

func (r *Repository) Create(ctx context.Context, skill *Skill) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/skills: repository is not initialized")
	}
	payload, id, err := marshalSkill(skill)
	if err != nil {
		return err
	}
	if _, err := r.resources.Insert(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domainerror.NewAlreadyExists("platformk8s/skills: skill %q already exists", id)
		}
		return err
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, skill *Skill) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/skills: repository is not initialized")
	}
	payload, id, err := marshalSkill(skill)
	if err != nil {
		return err
	}
	if _, err := r.resources.Update(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return skillNotFound(id)
		}
		return err
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, skillID string) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/skills: repository is not initialized")
	}
	skillID = strings.TrimSpace(skillID)
	if skillID == "" {
		return domainerror.NewValidation("platformk8s/skills: skill id is empty")
	}
	return r.resources.Delete(ctx, skillID)
}

func marshalSkill(skill *Skill) ([]byte, string, error) {
	if skill == nil {
		return nil, "", domainerror.NewValidation("platformk8s/skills: skill is nil")
	}
	value := skill.Proto()
	id := strings.TrimSpace(value.GetSkillId())
	if id == "" {
		return nil, "", domainerror.NewValidation("platformk8s/skills: skill id is empty")
	}
	payload, err := protojson.MarshalOptions{EmitUnpopulated: false}.Marshal(value)
	if err != nil {
		return nil, "", fmt.Errorf("platformk8s/skills: marshal skill %q: %w", id, err)
	}
	return payload, id, nil
}

func unmarshalSkill(id string, payload []byte) (*Skill, error) {
	value := &skillv1.Skill{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(payload, value); err != nil {
		return nil, fmt.Errorf("platformk8s/skills: unmarshal skill %q: %w", id, err)
	}
	return skillFromStored(id, value)
}

func skillNotFound(skillID string) error {
	return domainerror.NewNotFound("platformk8s/skills: skill %q not found", skillID)
}
