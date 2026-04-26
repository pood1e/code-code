package skills

import (
	"strings"

	"code-code.internal/go-contract/domainerror"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
	"code-code.internal/platform-k8s/internal/resourcemeta"
	"google.golang.org/protobuf/proto"
)

type Skill struct {
	value *skillv1.Skill
}

func NewSkill(input *skillv1.Skill) (*Skill, error) {
	if input == nil {
		return nil, domainerror.NewValidation("platformk8s/skills: skill is nil")
	}
	name := strings.TrimSpace(input.GetName())
	if name == "" {
		return nil, domainerror.NewValidation("platformk8s/skills: skill name is required")
	}
	content := strings.TrimSpace(input.GetContent())
	if content == "" {
		return nil, domainerror.NewValidation("platformk8s/skills: skill content is required")
	}
	skillID, err := resourcemeta.EnsureResourceID(strings.TrimSpace(input.GetSkillId()), name, "skill")
	if err != nil {
		return nil, err
	}
	return &Skill{
		value: &skillv1.Skill{
			SkillId:     skillID,
			Name:        name,
			Description: strings.TrimSpace(input.GetDescription()),
			Content:     content,
		},
	}, nil
}

func skillFromStored(id string, value *skillv1.Skill) (*Skill, error) {
	if value == nil {
		return nil, domainerror.NewValidation("platformk8s/skills: skill is nil")
	}
	next := proto.Clone(value).(*skillv1.Skill)
	id = strings.TrimSpace(id)
	if next.GetSkillId() == "" {
		next.SkillId = id
	}
	if next.GetSkillId() != id {
		return nil, domainerror.NewValidation("platformk8s/skills: skill id %q does not match stored id %q", next.GetSkillId(), id)
	}
	return NewSkill(next)
}

func NormalizeSkillID(skillID string) (string, error) {
	skillID = strings.TrimSpace(skillID)
	if skillID == "" {
		return "", domainerror.NewValidation("platformk8s/skills: skill id is empty")
	}
	return skillID, nil
}

func (s *Skill) ID() string {
	if s == nil || s.value == nil {
		return ""
	}
	return strings.TrimSpace(s.value.GetSkillId())
}

func (s *Skill) Proto() *skillv1.Skill {
	if s == nil || s.value == nil {
		return nil
	}
	return proto.Clone(s.value).(*skillv1.Skill)
}

func (s *Skill) ListItem() *managementv1.SkillListItem {
	if s == nil || s.value == nil {
		return &managementv1.SkillListItem{}
	}
	return &managementv1.SkillListItem{
		SkillId:     s.value.GetSkillId(),
		Name:        s.value.GetName(),
		Description: s.value.GetDescription(),
	}
}
