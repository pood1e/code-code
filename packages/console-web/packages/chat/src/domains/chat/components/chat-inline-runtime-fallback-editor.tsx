import { Button, Flex, Text } from "@radix-ui/themes";
import { FormSelectField, RuntimeFallbackList } from "@code-code/console-web-ui";
import { runtimeFallbackModelId } from "../runtime-model-selector";
import {
  sessionRuntimeSurfaceSelectItems,
  sessionRuntimeModelSelectItems,
  findSessionRuntimeSurface,
  runtimeRefKey,
  type SessionRuntimeProviderOption,
} from "../session-runtime-options";
import type { ChatInlineSetup } from "../types";

type ChatInlineRuntimeFallbackEditorProps = {
  items: ChatInlineSetup["runtimeConfig"]["fallbacks"];
  provider: SessionRuntimeProviderOption | null;
  disabled: boolean;
  onFallbackAdd: () => void;
  onFallbackRemove: (index: number) => void;
  onFallbackSurfaceChange: (index: number, surfaceValue: string) => void;
  onFallbackModelChange: (index: number, modelId: string) => void;
};

export function ChatInlineRuntimeFallbackEditor({
  items,
  provider,
  disabled,
  onFallbackAdd,
  onFallbackRemove,
  onFallbackSurfaceChange,
  onFallbackModelChange,
}: ChatInlineRuntimeFallbackEditorProps) {
  return (
    <div className="chatInlineRuntimeSection">
      <Flex justify="between" align="center">
        <Text size="2" weight="medium">Fallbacks</Text>
        <Button className="chatSetupSecondaryButton" variant="soft" disabled={disabled} onClick={onFallbackAdd}>
          <span className="chatButtonIcon" aria-hidden="true">
            <AddIcon />
          </span>
          Add Fallback
        </Button>
      </Flex>
      <RuntimeFallbackList
        items={items}
        rowKey={(item, index) => `${runtimeRefKey(item.providerRuntimeRef) || "fallback"}-${index}`}
        emptyText="No fallback candidates yet."
        emptyClassName="chatInlineRuntimeEmpty"
        onRemove={onFallbackRemove}
        canRemove={() => !disabled}
        renderRow={({ item, index, actions }) => (
          <Flex
            direction={{ initial: "column", md: "row" }}
            gap="3"
            align={{ initial: "stretch", md: "end" }}
            className="chatInlineRuntimeFallbackRow"
          >
            <FormSelectField
              label={`Fallback ${index + 1} Surface`}
              className="chatField"
              labelClassName="chatFieldLabel"
              triggerClassName="chatFieldTrigger"
              value={runtimeRefKey(item.providerRuntimeRef)}
              disabled={disabled || !provider}
              items={sessionRuntimeSurfaceSelectItems(provider)}
              onValueChange={(value) => onFallbackSurfaceChange(index, value)}
            />
            <FormSelectField
              label={`Fallback ${index + 1} Model`}
              className="chatField"
              labelClassName="chatFieldLabel"
              triggerClassName="chatFieldTrigger"
              value={runtimeFallbackModelId(item)}
              disabled={disabled || !findSessionRuntimeSurface(provider, item.providerRuntimeRef)}
              items={sessionRuntimeModelSelectItems(findSessionRuntimeSurface(provider, item.providerRuntimeRef))}
              placeholder="Select model"
              onValueChange={(value) => onFallbackModelChange(index, value)}
            />
            {actions}
          </Flex>
        )}
      />
    </div>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
