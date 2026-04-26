import { Flex, Text } from "@radix-ui/themes";
import { ActionIconButton } from "@code-code/console-web-ui";
import { PlusIcon } from "./action-icons";
import { FallbackChainEditor } from "./fallback-chain";
import { ProfileEditorSectionCard } from "./profile-editor-section-card";
import type { SelectionFallback } from "../domain/types";

type Props = {
  supportedTypesLabel: string;
  fallbackProvidersCount: number;
  fallbackChain: SelectionFallback[];
  onOpenPicker: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
};

export function ProfileEditorFallbackSection({
  supportedTypesLabel,
  fallbackProvidersCount,
  fallbackChain,
  onOpenPicker,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props) {
  return (
    <ProfileEditorSectionCard title="Fallback chain">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="1" color="gray">
          Supported provider types: {supportedTypesLabel || "None"}
        </Text>
        <ActionIconButton
          aria-label="Add fallback"
          title="Add fallback"
          disabled={fallbackProvidersCount === 0}
          onClick={onOpenPicker}
        >
          <PlusIcon />
        </ActionIconButton>
      </Flex>

      <FallbackChainEditor
        items={fallbackChain}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
      />
    </ProfileEditorSectionCard>
  );
}
