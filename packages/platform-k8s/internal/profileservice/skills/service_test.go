package skills

import (
	"context"
	"testing"

	"code-code.internal/go-contract/domainerror"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
)

func TestServiceListReturnsStoredSkills(t *testing.T) {
	t.Parallel()

	store := newMemorySkillStore(t,
		&skillv1.Skill{SkillId: "z-skill", Name: "Z Skill", Content: "Use exact dates."},
		&skillv1.Skill{SkillId: "a-skill", Name: "A Skill", Content: "Be concise."},
	)
	service, err := NewService(store, noopProfileReferenceUpdater{})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got, want := len(items), 2; got != want {
		t.Fatalf("len(items) = %d, want %d", got, want)
	}
	if got, want := items[0].GetSkillId(), "a-skill"; got != want {
		t.Fatalf("skill_id = %q, want %q", got, want)
	}
}

type memorySkillStore struct {
	items map[string]*Skill
}

func newMemorySkillStore(t *testing.T, values ...*skillv1.Skill) *memorySkillStore {
	t.Helper()

	store := &memorySkillStore{items: map[string]*Skill{}}
	for _, value := range values {
		skill, err := NewSkill(value)
		if err != nil {
			t.Fatalf("NewSkill() error = %v", err)
		}
		store.items[skill.ID()] = skill
	}
	return store
}

func (s *memorySkillStore) List(context.Context) ([]*Skill, error) {
	out := make([]*Skill, 0, len(s.items))
	for _, item := range s.items {
		out = append(out, item)
	}
	return out, nil
}

func (s *memorySkillStore) Load(_ context.Context, skillID string) (*Skill, error) {
	if item, ok := s.items[skillID]; ok {
		return item, nil
	}
	return nil, domainerror.NewNotFound("test skill %q not found", skillID)
}

func (s *memorySkillStore) Create(_ context.Context, skill *Skill) error {
	s.items[skill.ID()] = skill
	return nil
}

func (s *memorySkillStore) Update(_ context.Context, skill *Skill) error {
	s.items[skill.ID()] = skill
	return nil
}

func (s *memorySkillStore) Delete(_ context.Context, skillID string) error {
	delete(s.items, skillID)
	return nil
}

type noopProfileReferenceUpdater struct{}

func (noopProfileReferenceUpdater) DetachSkill(context.Context, string) error {
	return nil
}
