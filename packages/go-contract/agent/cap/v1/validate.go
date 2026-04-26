package capv1

import "fmt"

// ValidateCapabilities validates one provider capability declaration.
func ValidateCapabilities(capabilities *Capabilities) error {
	if capabilities == nil {
		return fmt.Errorf("capv1: capabilities is nil")
	}
	if capabilities.ResumeAfterInstructionChange && !capabilities.Resume {
		return fmt.Errorf("capv1: resume_after_instruction_change requires resume support")
	}
	if capabilities.ResumeAfterInstructionChange && !capabilities.Instructions {
		return fmt.Errorf("capv1: resume_after_instruction_change requires instructions support")
	}
	if capabilities.ResumeAfterToolChange && !capabilities.Resume {
		return fmt.Errorf("capv1: resume_after_tool_change requires resume support")
	}
	if capabilities.ResumeAfterToolChange && !capabilities.Tools {
		return fmt.Errorf("capv1: resume_after_tool_change requires tools support")
	}
	if capabilities.HeadlessCompaction && !capabilities.Resume {
		return fmt.Errorf("capv1: headless_compaction requires resume support")
	}
	return nil
}

// ValidateAgentResources validates one resource snapshot applied to an agent runtime.
func ValidateAgentResources(resources *AgentResources) error {
	if resources == nil {
		return fmt.Errorf("capv1: agent resources is nil")
	}
	if resources.SnapshotId == "" {
		return fmt.Errorf("capv1: agent resources snapshot id is empty")
	}
	instructionNames := map[string]struct{}{}
	for _, instruction := range resources.Instructions {
		if instruction == nil {
			return fmt.Errorf("capv1: instruction resource is nil")
		}
		if instruction.Kind == InstructionKind_INSTRUCTION_KIND_UNSPECIFIED {
			return fmt.Errorf("capv1: instruction resource kind is unspecified")
		}
		if instruction.Name == "" {
			return fmt.Errorf("capv1: instruction resource name is empty")
		}
		if instruction.Content == "" {
			return fmt.Errorf("capv1: instruction resource content is empty")
		}
		if _, ok := instructionNames[instruction.Name]; ok {
			return fmt.Errorf("capv1: duplicate instruction resource name %q", instruction.Name)
		}
		instructionNames[instruction.Name] = struct{}{}
	}
	toolNames := map[string]struct{}{}
	for _, binding := range resources.ToolBindings {
		if binding == nil {
			return fmt.Errorf("capv1: tool binding is nil")
		}
		if binding.Name == "" {
			return fmt.Errorf("capv1: tool binding name is empty")
		}
		if binding.Kind == ToolKind_TOOL_KIND_UNSPECIFIED {
			return fmt.Errorf("capv1: tool binding kind is unspecified")
		}
		if binding.Target == "" {
			return fmt.Errorf("capv1: tool binding target is empty")
		}
		if _, ok := toolNames[binding.Name]; ok {
			return fmt.Errorf("capv1: duplicate tool binding name %q", binding.Name)
		}
		toolNames[binding.Name] = struct{}{}
	}
	return nil
}
