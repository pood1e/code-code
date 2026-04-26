import { Flex, Text } from "@radix-ui/themes";
import { FormSelectField } from "@code-code/console-web-ui";
import {
  sessionRuntimeSurfaceSelectItems,
  sessionRuntimeModelSelectItems,
  findSessionRuntimeSurface,
  type SessionRuntimeProviderOption,
} from "../session-runtime-options";

type ChatInlineRuntimePrimaryEditorProps = {
  provider: SessionRuntimeProviderOption | null;
  primarySurfaceValue: string;
  primaryModelId: string;
  currentModelId?: string;
  disabled: boolean;
  onPrimarySurfaceChange: (surfaceValue: string) => void;
  onPrimaryModelChange: (modelId: string) => void;
};

export function ChatInlineRuntimePrimaryEditor({
  provider,
  primarySurfaceValue,
  primaryModelId,
  currentModelId,
  disabled,
  onPrimarySurfaceChange,
  onPrimaryModelChange,
}: ChatInlineRuntimePrimaryEditorProps) {
  const selectedSurface = findSessionRuntimeSurface(provider, primarySurfaceValue);

  return (
    <div className="chatInlineRuntimeSection">
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">Primary</Text>
        {currentModelId ? <Text size="1" color="gray">Active: {currentModelId}</Text> : null}
      </Flex>
      <Flex direction={{ initial: "column", md: "row" }} gap="3" className="chatInlineRuntimePrimaryGrid">
        <FormSelectField
          label="Provider Surface"
          className="chatField"
          labelClassName="chatFieldLabel"
          triggerClassName="chatFieldTrigger"
          value={primarySurfaceValue}
          disabled={disabled || !provider}
          items={sessionRuntimeSurfaceSelectItems(provider)}
          onValueChange={onPrimarySurfaceChange}
        />
        <FormSelectField
          label="Model"
          className="chatField"
          labelClassName="chatFieldLabel"
          triggerClassName="chatFieldTrigger"
          value={primaryModelId}
          disabled={disabled || !selectedSurface}
          items={sessionRuntimeModelSelectItems(selectedSurface)}
          placeholder="Select model"
          onValueChange={onPrimaryModelChange}
        />
      </Flex>
    </div>
  );
}
