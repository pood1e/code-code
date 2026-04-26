import { Button, Flex, Text } from "@radix-ui/themes";
import type { ChatInlineSetup } from "../types";
import { runtimePrimaryModelId } from "../runtime-model-selector";
import { NoDataCallout } from "@code-code/console-web-ui";
import { FormSelectField } from "@code-code/console-web-ui";
import { ChatInlineRuntimeFallbackEditor } from "./chat-inline-runtime-fallback-editor";
import { ChatInlineRuntimePrimaryEditor } from "./chat-inline-runtime-primary-editor";
import {
  sessionRuntimeExecutionClassSelectItems,
  sessionRuntimeProviderSelectItems,
  findSessionRuntimeProvider,
  runtimeRefKey,
  type SessionRuntimeOptions,
} from "../session-runtime-options";

type ChatInlineRuntimeEditorProps = {
  draft: ChatInlineSetup | null;
  runtimeOptions: SessionRuntimeOptions;
  runtimeOptionsLoading: boolean;
  currentModelId?: string;
  open: boolean;
  disabled: boolean;
  onProviderIdChange: (value: string) => void;
  onExecutionClassChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPrimarySurfaceChange: (surfaceId: string) => void;
  onPrimaryModelChange: (modelId: string) => void;
  onFallbackAdd: () => void;
  onFallbackRemove: (index: number) => void;
  onFallbackSurfaceChange: (index: number, surfaceId: string) => void;
  onFallbackModelChange: (index: number, modelId: string) => void;
};

export function ChatInlineRuntimeEditor({
  draft,
  runtimeOptions,
  runtimeOptionsLoading,
  currentModelId,
  open,
  disabled,
  onProviderIdChange,
  onExecutionClassChange,
  onOpenChange,
  onPrimarySurfaceChange,
  onPrimaryModelChange,
  onFallbackAdd,
  onFallbackRemove,
  onFallbackSurfaceChange,
  onFallbackModelChange,
}: ChatInlineRuntimeEditorProps) {
  if (!draft) {
    return (
      <NoDataCallout className="chatSetupCallout">
        Inline draft is initializing.
      </NoDataCallout>
    );
  }

  const selectedProvider = findSessionRuntimeProvider(runtimeOptions, draft.providerId);
  const primarySurfaceValue = runtimeRefKey(draft.runtimeConfig.providerRuntimeRef);
  const primaryModelId = runtimePrimaryModelId(draft.runtimeConfig.primaryModelSelector);
  const resourceSummary = `${draft.resourceConfig.instructions.length} instructions · ${draft.resourceConfig.toolBindings.length} MCP tools`;

  return (
    <Flex direction="column" gap="3" className="chatInlineRuntime">
      <Flex justify="between" align={{ initial: "start", md: "center" }} direction={{ initial: "column", md: "row" }} gap="3" className="chatInlineRuntimeHeader">
        <div>
          <Text size="2" weight="medium">Inline Runtime</Text>
          <Text size="1" color="gray" className="chatInlineRuntimeSummary">{resourceSummary}</Text>
        </div>
        <Button className="chatSetupSecondaryButton" variant="soft" disabled={disabled} onClick={() => onOpenChange(!open)}>
          <span className="chatButtonIcon" aria-hidden="true">
            <EditIcon />
          </span>
          {open ? "Hide" : "Edit"}
        </Button>
      </Flex>

      {open ? (
        <Flex direction="column" gap="3" className="chatInlineRuntimeEditor">
          <div className="chatInlineFixedSection">
            <Text size="2" weight="medium">CLI Identity</Text>
            <Flex gap="3" direction={{ initial: "column", sm: "row" }} className="chatInlineRuntimePrimaryGrid">
              <FormSelectField
                label="CLI"
                className="chatField"
                labelClassName="chatFieldLabel"
                triggerClassName="chatFieldTrigger"
                value={draft.providerId}
                items={sessionRuntimeProviderSelectItems(runtimeOptions)}
                loading={runtimeOptionsLoading}
                disabled={disabled || runtimeOptionsLoading}
                placeholder="Select CLI"
                onValueChange={onProviderIdChange}
              />
              <FormSelectField
                label="Image Variant"
                className="chatField"
                labelClassName="chatFieldLabel"
                triggerClassName="chatFieldTrigger"
                value={draft.executionClass}
                items={sessionRuntimeExecutionClassSelectItems(selectedProvider)}
                disabled={disabled || !draft.providerId}
                placeholder="Select image variant"
                onValueChange={onExecutionClassChange}
              />
            </Flex>
          </div>

          <ChatInlineRuntimePrimaryEditor
            provider={selectedProvider}
            primarySurfaceValue={primarySurfaceValue}
            primaryModelId={primaryModelId}
            currentModelId={currentModelId}
            disabled={disabled}
            onPrimarySurfaceChange={onPrimarySurfaceChange}
            onPrimaryModelChange={onPrimaryModelChange}
          />

          <ChatInlineRuntimeFallbackEditor
            items={draft.runtimeConfig.fallbacks}
            provider={selectedProvider}
            disabled={disabled}
            onFallbackAdd={onFallbackAdd}
            onFallbackRemove={onFallbackRemove}
            onFallbackSurfaceChange={onFallbackSurfaceChange}
            onFallbackModelChange={onFallbackModelChange}
          />
        </Flex>
      ) : null}
    </Flex>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}
