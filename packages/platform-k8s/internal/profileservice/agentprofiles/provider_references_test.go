package agentprofiles

import (
	"context"
	"strings"

	mcpv1 "code-code.internal/go-contract/platform/mcp/v1"
	rulev1 "code-code.internal/go-contract/platform/rule/v1"
	skillv1 "code-code.internal/go-contract/platform/skill/v1"
	supportv1 "code-code.internal/go-contract/platform/support/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
)

type allowingProviderReferences struct{}

func (allowingProviderReferences) ProviderExists(context.Context, string) error {
	return nil
}

func (allowingProviderReferences) ExecutionClassExists(context.Context, string, string) error {
	return nil
}

func (allowingProviderReferences) SurfaceExists(context.Context, string) error {
	return nil
}

func (allowingProviderReferences) RuntimeCapabilitySupported(context.Context, string, string) error {
	return nil
}

type allowingResourceReferences struct{}

func (allowingResourceReferences) MCPExists(context.Context, string) error {
	return nil
}

func (allowingResourceReferences) SkillExists(context.Context, string) error {
	return nil
}

func (allowingResourceReferences) RuleExists(context.Context, string) error {
	return nil
}

type testProviderReferences struct {
	providers        map[string]struct{}
	executionClasses map[string]map[string]struct{}
	surfaces         map[string]struct{}
	capabilities     map[string]map[string]bool
}

func newProviderReferencesFromObjects(objects []any) testProviderReferences {
	refs := testProviderReferences{
		providers:        map[string]struct{}{},
		executionClasses: map[string]map[string]struct{}{},
		surfaces:         map[string]struct{}{},
		capabilities:     map[string]map[string]bool{},
	}
	for _, object := range objects {
		switch resource := object.(type) {
		case testCLIReference:
			cliID := strings.TrimSpace(resource.cliID)
			refs.providers[cliID] = struct{}{}
			if refs.executionClasses[cliID] == nil {
				refs.executionClasses[cliID] = map[string]struct{}{}
			}
			for _, executionClass := range resource.executionClasses {
				refs.executionClasses[cliID][strings.TrimSpace(executionClass)] = struct{}{}
			}
		case testCLISupport:
			cliID := strings.TrimSpace(resource.cliID)
			refs.providers[cliID] = struct{}{}
			if refs.capabilities[cliID] == nil {
				refs.capabilities[cliID] = map[string]bool{}
			}
			for _, capability := range resource.capabilities {
				refs.capabilities[cliID][testCapabilityKind(capability.GetKind())] = capability.GetSupported()
			}
		case *providerv1.Provider:
			for _, surface := range resource.GetSurfaces() {
				refs.surfaces[strings.TrimSpace(surface.GetSurfaceId())] = struct{}{}
			}
		}
	}
	return refs
}

type testCLIReference struct {
	cliID            string
	executionClasses []string
}

func newTestCLIReference(cliID string, executionClasses ...string) testCLIReference {
	if len(executionClasses) == 0 {
		executionClasses = []string{"default"}
	}
	return testCLIReference{cliID: cliID, executionClasses: executionClasses}
}

type testResourceReferences struct {
	mcps   map[string]struct{}
	skills map[string]struct{}
	rules  map[string]struct{}
}

func newResourceReferencesFromObjects(objects []any) testResourceReferences {
	refs := testResourceReferences{
		mcps:   map[string]struct{}{},
		skills: map[string]struct{}{},
		rules:  map[string]struct{}{},
	}
	for _, object := range objects {
		switch value := object.(type) {
		case *mcpv1.MCPServer:
			refs.mcps[strings.TrimSpace(value.GetMcpId())] = struct{}{}
		case *skillv1.Skill:
			refs.skills[strings.TrimSpace(value.GetSkillId())] = struct{}{}
		case *rulev1.Rule:
			refs.rules[strings.TrimSpace(value.GetRuleId())] = struct{}{}
		}
	}
	return refs
}

func (r testResourceReferences) MCPExists(_ context.Context, mcpID string) error {
	if _, ok := r.mcps[strings.TrimSpace(mcpID)]; ok {
		return nil
	}
	return validationf("mcp %q not found", mcpID)
}

func (r testResourceReferences) SkillExists(_ context.Context, skillID string) error {
	if _, ok := r.skills[strings.TrimSpace(skillID)]; ok {
		return nil
	}
	return validationf("skill %q not found", skillID)
}

func (r testResourceReferences) RuleExists(_ context.Context, ruleID string) error {
	if _, ok := r.rules[strings.TrimSpace(ruleID)]; ok {
		return nil
	}
	return validationf("rule %q not found", ruleID)
}

func (r testProviderReferences) ProviderExists(_ context.Context, providerID string) error {
	if _, ok := r.providers[strings.TrimSpace(providerID)]; ok {
		return nil
	}
	return validationf("provider %q not found", providerID)
}

func (r testProviderReferences) ExecutionClassExists(_ context.Context, providerID, executionClass string) error {
	if classes := r.executionClasses[strings.TrimSpace(providerID)]; classes != nil {
		if _, ok := classes[strings.TrimSpace(executionClass)]; ok {
			return nil
		}
	}
	return validationf("execution class %q is not declared by cli definition %q", executionClass, providerID)
}

func (r testProviderReferences) SurfaceExists(_ context.Context, surfaceID string) error {
	if _, ok := r.surfaces[strings.TrimSpace(surfaceID)]; ok {
		return nil
	}
	return validationf("provider surface binding %q not found", surfaceID)
}

func (r testProviderReferences) RuntimeCapabilitySupported(_ context.Context, providerID, kind string) error {
	if capabilities := r.capabilities[strings.TrimSpace(providerID)]; capabilities != nil {
		if capabilities[strings.TrimSpace(kind)] {
			return nil
		}
	}
	return validationf("provider %q does not support %s resources", providerID, kind)
}

func testCapabilityKind(kind supportv1.RuntimeCapabilityKind) string {
	switch kind {
	case supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_MCP:
		return "mcp"
	case supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_SKILL:
		return "skill"
	case supportv1.RuntimeCapabilityKind_RUNTIME_CAPABILITY_KIND_RULE:
		return "rule"
	default:
		return ""
	}
}
