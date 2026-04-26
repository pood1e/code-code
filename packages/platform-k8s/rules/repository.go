package rules

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"code-code.internal/go-contract/domainerror"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
	statepostgres "code-code.internal/platform-k8s/state/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/encoding/protojson"
)

const postgresRuleTable = "platform_rules"

type Store interface {
	List(context.Context) ([]*Rule, error)
	Load(context.Context, string) (*Rule, error)
	Create(context.Context, *Rule) error
	Update(context.Context, *Rule) error
	Delete(context.Context, string) error
}

type Repository struct {
	resources *statepostgres.JSONRepository
}

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	resources, err := statepostgres.NewJSONRepository(pool, postgresRuleTable)
	if err != nil {
		return nil, err
	}
	return &Repository{resources: resources}, nil
}

func (r *Repository) List(ctx context.Context) ([]*Rule, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/rules: repository is not initialized")
	}
	records, err := r.resources.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]*Rule, 0, len(records))
	for _, record := range records {
		rule, err := unmarshalRule(record.ID, record.Payload)
		if err != nil {
			return nil, err
		}
		items = append(items, rule)
	}
	return items, nil
}

func (r *Repository) Load(ctx context.Context, ruleID string) (*Rule, error) {
	if r == nil || r.resources == nil {
		return nil, fmt.Errorf("platformk8s/rules: repository is not initialized")
	}
	ruleID = strings.TrimSpace(ruleID)
	if ruleID == "" {
		return nil, domainerror.NewValidation("platformk8s/rules: rule id is empty")
	}
	payload, _, err := r.resources.Get(ctx, ruleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ruleNotFound(ruleID)
		}
		return nil, err
	}
	return unmarshalRule(ruleID, payload)
}

func (r *Repository) Create(ctx context.Context, rule *Rule) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/rules: repository is not initialized")
	}
	payload, id, err := marshalRule(rule)
	if err != nil {
		return err
	}
	if _, err := r.resources.Insert(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domainerror.NewAlreadyExists("platformk8s/rules: rule %q already exists", id)
		}
		return err
	}
	return nil
}

func (r *Repository) Update(ctx context.Context, rule *Rule) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/rules: repository is not initialized")
	}
	payload, id, err := marshalRule(rule)
	if err != nil {
		return err
	}
	if _, err := r.resources.Update(ctx, id, payload); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ruleNotFound(id)
		}
		return err
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, ruleID string) error {
	if r == nil || r.resources == nil {
		return fmt.Errorf("platformk8s/rules: repository is not initialized")
	}
	ruleID = strings.TrimSpace(ruleID)
	if ruleID == "" {
		return domainerror.NewValidation("platformk8s/rules: rule id is empty")
	}
	return r.resources.Delete(ctx, ruleID)
}

func marshalRule(rule *Rule) ([]byte, string, error) {
	if rule == nil {
		return nil, "", domainerror.NewValidation("platformk8s/rules: rule is nil")
	}
	value := rule.Proto()
	id := strings.TrimSpace(value.GetRuleId())
	if id == "" {
		return nil, "", domainerror.NewValidation("platformk8s/rules: rule id is empty")
	}
	payload, err := protojson.MarshalOptions{EmitUnpopulated: false}.Marshal(value)
	if err != nil {
		return nil, "", fmt.Errorf("platformk8s/rules: marshal rule %q: %w", id, err)
	}
	return payload, id, nil
}

func unmarshalRule(id string, payload []byte) (*Rule, error) {
	value := &rulev1.Rule{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(payload, value); err != nil {
		return nil, fmt.Errorf("platformk8s/rules: unmarshal rule %q: %w", id, err)
	}
	return ruleFromStored(id, value)
}

func ruleNotFound(ruleID string) error {
	return domainerror.NewNotFound("platformk8s/rules: rule %q not found", ruleID)
}
