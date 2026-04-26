import { Flex } from "@radix-ui/themes";
import { ProfileResourceSelectionTab } from "./profile-resource-selection-tab";
import { ProfileEditorSectionCard } from "./profile-editor-section-card";
import type { MCPResourceSummary, TextResourceSummary } from "../domain/types";

type Props = {
  selectedMcps: MCPResourceSummary[];
  selectedSkills: TextResourceSummary[];
  selectedRules: TextResourceSummary[];
  availableMcps: MCPResourceSummary[];
  availableSkills: TextResourceSummary[];
  availableRules: TextResourceSummary[];
  onAttachMCP: (id: string) => void;
  onRemoveMCP: (id: string) => void;
  onAttachSkill: (id: string) => void;
  onRemoveSkill: (id: string) => void;
  onAttachRule: (id: string) => void;
  onRemoveRule: (id: string) => void;
};

export function ProfileEditorResourcesSection({
  selectedMcps,
  selectedSkills,
  selectedRules,
  availableMcps,
  availableSkills,
  availableRules,
  onAttachMCP,
  onRemoveMCP,
  onAttachSkill,
  onRemoveSkill,
  onAttachRule,
  onRemoveRule,
}: Props) {
  return (
    <ProfileEditorSectionCard title="Resources">
      <Flex direction="column" gap="2">
        <ProfileResourceSelectionTab
          label="MCPs"
          pickerTitle="Attach MCPs"
          selectedItems={selectedMcps}
          availableItems={availableMcps}
          onAttach={onAttachMCP}
          onRemove={onRemoveMCP}
        />
        <ProfileResourceSelectionTab
          label="Skills"
          pickerTitle="Attach Skills"
          selectedItems={selectedSkills}
          availableItems={availableSkills}
          onAttach={onAttachSkill}
          onRemove={onRemoveSkill}
        />
        <ProfileResourceSelectionTab
          label="Rules"
          pickerTitle="Attach Rules"
          selectedItems={selectedRules}
          availableItems={availableRules}
          onAttach={onAttachRule}
          onRemove={onRemoveRule}
        />
      </Flex>
    </ProfileEditorSectionCard>
  );
}
