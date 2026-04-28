package skills

import (
	"context"
	"fmt"
	"slices"
	"strings"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
	"google.golang.org/protobuf/proto"
)

type ProfileReferenceUpdater interface {
	DetachSkill(ctx context.Context, skillID string) error
}

type Service struct {
	store    Store
	profiles ProfileReferenceUpdater
}

func NewService(store Store, profiles ProfileReferenceUpdater) (*Service, error) {
	if store == nil {
		return nil, fmt.Errorf("platformk8s/skills: store is nil")
	}
	if profiles == nil {
		return nil, fmt.Errorf("platformk8s/skills: profile reference updater is nil")
	}
	return &Service{
		store:    store,
		profiles: profiles,
	}, nil
}

func (s *Service) List(ctx context.Context) ([]*managementv1.SkillListItem, error) {
	skills, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("platformk8s/skills: list skills: %w", err)
	}
	items := make([]*managementv1.SkillListItem, 0, len(skills))
	for _, skill := range skills {
		items = append(items, skill.ListItem())
	}
	slices.SortFunc(items, func(a, b *managementv1.SkillListItem) int {
		if a.GetName() != b.GetName() {
			return strings.Compare(a.GetName(), b.GetName())
		}
		return strings.Compare(a.GetSkillId(), b.GetSkillId())
	})
	return items, nil
}

func (s *Service) Get(ctx context.Context, skillID string) (*skillv1.Skill, error) {
	skill, err := s.store.Load(ctx, skillID)
	if err != nil {
		return nil, err
	}
	return skill.Proto(), nil
}

func (s *Service) Create(ctx context.Context, input *skillv1.Skill) (*skillv1.Skill, error) {
	skill, err := NewSkill(input)
	if err != nil {
		return nil, err
	}
	if err := s.store.Create(ctx, skill); err != nil {
		return nil, err
	}
	return skill.Proto(), nil
}

func (s *Service) Update(ctx context.Context, skillID string, input *skillv1.Skill) (*skillv1.Skill, error) {
	skill, err := NewSkill(skillWithID(input, skillID))
	if err != nil {
		return nil, err
	}
	if err := s.store.Update(ctx, skill); err != nil {
		return nil, err
	}
	return skill.Proto(), nil
}

func (s *Service) Delete(ctx context.Context, skillID string) error {
	nextSkillID, err := NormalizeSkillID(skillID)
	if err != nil {
		return err
	}
	if err := s.profiles.DetachSkill(ctx, nextSkillID); err != nil {
		return err
	}
	return s.store.Delete(ctx, nextSkillID)
}

func skillWithID(input *skillv1.Skill, skillID string) *skillv1.Skill {
	next := &skillv1.Skill{}
	if input != nil {
		next = proto.Clone(input).(*skillv1.Skill)
	}
	next.SkillId = strings.TrimSpace(skillID)
	return next
}
