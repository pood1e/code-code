import { create } from "@bufbuild/protobuf";
import { AgentSessionRuntimeModelSelectorSchema } from "@code-code/agent-contract/platform/agent-session/v1";
import type { ChatInlineSetup } from "./types";

export const PROVIDER_MODEL_SELECTOR_CASE = "providerModelId" as const;
const MODEL_REF_SELECTOR_CASE = "modelRef" as const;

export function runtimePrimaryModelId(
  value: ChatInlineSetup["runtimeConfig"]["primaryModelSelector"],
) {
  if (!value) {
    return "";
  }
  if (value.selector.case === PROVIDER_MODEL_SELECTOR_CASE) {
    return value.selector.value;
  }
  if (value.selector.case === MODEL_REF_SELECTOR_CASE) {
    return value.selector.value.modelId;
  }
  return "";
}

export function runtimeFallbackModelId(
  value: ChatInlineSetup["runtimeConfig"]["fallbacks"][number],
) {
  if (value.modelSelector.case === PROVIDER_MODEL_SELECTOR_CASE) {
    return value.modelSelector.value;
  }
  if (value.modelSelector.case === MODEL_REF_SELECTOR_CASE) {
    return value.modelSelector.value.modelId;
  }
  return "";
}

export function createProviderModelSelector(modelId: string) {
  return create(AgentSessionRuntimeModelSelectorSchema, {
    selector: { case: PROVIDER_MODEL_SELECTOR_CASE, value: modelId },
  });
}

export function createProviderFallbackModelSelector(modelId: string) {
  return { case: PROVIDER_MODEL_SELECTOR_CASE, value: modelId };
}
