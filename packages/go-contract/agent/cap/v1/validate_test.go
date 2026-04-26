package capv1

import "testing"

func TestValidateCapabilitiesAcceptsConsistentDeclaration(t *testing.T) {
	t.Parallel()

	capabilities := &Capabilities{
		Resume:                       true,
		Tools:                        true,
		Instructions:                 true,
		ResumeAfterInstructionChange: true,
		ResumeAfterToolChange:        true,
		HeadlessCompaction:           true,
	}

	if err := ValidateCapabilities(capabilities); err != nil {
		t.Fatalf("ValidateCapabilities() error = %v", err)
	}
}

func TestValidateCapabilitiesRejectsInstructionResumeWithoutResume(t *testing.T) {
	t.Parallel()

	capabilities := &Capabilities{
		Instructions:                 true,
		ResumeAfterInstructionChange: true,
	}

	if err := ValidateCapabilities(capabilities); err == nil {
		t.Fatal("ValidateCapabilities() expected error, got nil")
	}
}

func TestValidateCapabilitiesRejectsToolResumeWithoutTools(t *testing.T) {
	t.Parallel()

	capabilities := &Capabilities{
		Resume:                true,
		ResumeAfterToolChange: true,
	}

	if err := ValidateCapabilities(capabilities); err == nil {
		t.Fatal("ValidateCapabilities() expected error, got nil")
	}
}

func TestValidateAgentResourcesAcceptsValidSnapshot(t *testing.T) {
	t.Parallel()

	resources := &AgentResources{
		SnapshotId: "snapshot-1",
		Instructions: []*InstructionResource{
			{
				Kind:    InstructionKind_INSTRUCTION_KIND_RULE,
				Name:    "global",
				Content: "be strict",
			},
		},
		ToolBindings: []*ToolBinding{
			{
				Name:   "search",
				Kind:   ToolKind_TOOL_KIND_MCP,
				Target: "mcp://search",
			},
		},
	}

	if err := ValidateAgentResources(resources); err != nil {
		t.Fatalf("ValidateAgentResources() error = %v", err)
	}
}

func TestValidateAgentResourcesRejectsDuplicateInstructionName(t *testing.T) {
	t.Parallel()

	resources := &AgentResources{
		SnapshotId: "snapshot-1",
		Instructions: []*InstructionResource{
			{
				Kind:    InstructionKind_INSTRUCTION_KIND_RULE,
				Name:    "global",
				Content: "a",
			},
			{
				Kind:    InstructionKind_INSTRUCTION_KIND_SKILL,
				Name:    "global",
				Content: "b",
			},
		},
	}

	if err := ValidateAgentResources(resources); err == nil {
		t.Fatal("ValidateAgentResources() expected error, got nil")
	}
}

func TestValidateAgentResourcesRejectsEmptyToolTarget(t *testing.T) {
	t.Parallel()

	resources := &AgentResources{
		SnapshotId: "snapshot-1",
		ToolBindings: []*ToolBinding{
			{
				Name: "search",
				Kind: ToolKind_TOOL_KIND_MCP,
			},
		},
	}

	if err := ValidateAgentResources(resources); err == nil {
		t.Fatal("ValidateAgentResources() expected error, got nil")
	}
}
