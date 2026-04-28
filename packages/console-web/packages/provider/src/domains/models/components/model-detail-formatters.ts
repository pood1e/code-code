import {
  AliasKind,
  ModelCapability,
  ModelShape,
  Modality,
  ModelCategory,
  ModelLifecycleStatus,
  type ModelVersion,
  type ModelAlias
} from "@code-code/agent-contract/model/v1";

export const EMPTY_VALUE = "Not set";

export function formatAlias(alias: ModelAlias) {
  const value = alias.value.trim();
  return value ? `${formatAliasKind(alias.kind)}: ${value}` : formatAliasKind(alias.kind);
}

export function formatAliasKind(kind: AliasKind) {
  switch (kind) {
    case AliasKind.STABLE:
      return "Stable";
    case AliasKind.SNAPSHOT:
      return "Snapshot";
    case AliasKind.BEDROCK:
      return "Bedrock";
    case AliasKind.VERTEX:
      return "Vertex";
    default:
      return "Unspecified";
  }
}

export function formatCapability(capability: ModelCapability) {
  switch (capability) {
    case ModelCapability.TOOL_CALLING:
      return "Tools";
    case ModelCapability.STRUCTURED_OUTPUT:
      return "JSON";
    case ModelCapability.IMAGE_INPUT:
      return "Vision";
    case ModelCapability.STREAMING:
      return "Stream";
    case ModelCapability.REASONING:
      return "Reasoning";
    case ModelCapability.BATCH:
      return "Batch";
    case ModelCapability.FINE_TUNE:
      return "Fine-tune";
    case ModelCapability.EMBEDDING:
      return "Embedding";
    case ModelCapability.RERANK:
      return "Rerank";
    case ModelCapability.JSON_MODE:
      return "JSON Mode";
    case ModelCapability.JSON_SCHEMA:
      return "JSON Schema";
    case ModelCapability.AUDIO_INPUT:
      return "Audio In";
    case ModelCapability.AUDIO_OUTPUT:
      return "Audio Out";
    case ModelCapability.VIDEO_INPUT:
      return "Video In";
    default:
      return "Unspecified";
  }
}

export function formatShape(shape: ModelShape) {
  switch (shape) {
    case ModelShape.RESPONSES:
      return "Responses";
    case ModelShape.CHAT_COMPLETIONS:
      return "Chat Completions";
    case ModelShape.ANTHROPIC_MESSAGES:
      return "Anthropic Messages";
    default:
      return "Unspecified";
  }
}

export function formatModality(modality: Modality) {
  switch (modality) {
    case Modality.TEXT:
      return "Text";
    case Modality.IMAGE:
      return "Image";
    case Modality.AUDIO:
      return "Audio";
    case Modality.VIDEO:
      return "Video";
    default:
      return "Unspecified";
  }
}

export function formatCategory(category: ModelCategory) {
  switch (category) {
    case ModelCategory.CHAT:
      return "Chat";
    case ModelCategory.EMBEDDING:
      return "Embedding";
    case ModelCategory.RERANK:
      return "Rerank";
    case ModelCategory.IMAGE_GEN:
      return "Image Gen";
    case ModelCategory.AUDIO:
      return "Audio";
    case ModelCategory.VIDEO:
      return "Video";
    case ModelCategory.MODERATION:
      return "Moderation";
    default:
      return "Unspecified";
  }
}

// All category values suitable for filter chip bars (excluding UNSPECIFIED).
export const CATEGORY_OPTIONS: { value: ModelCategory; label: string }[] = [
  { value: ModelCategory.CHAT, label: "Chat" },
  { value: ModelCategory.EMBEDDING, label: "Embedding" },
  { value: ModelCategory.RERANK, label: "Rerank" },
  { value: ModelCategory.IMAGE_GEN, label: "Image Gen" },
  { value: ModelCategory.AUDIO, label: "Audio" },
  { value: ModelCategory.VIDEO, label: "Video" },
  { value: ModelCategory.MODERATION, label: "Moderation" },
];

export type RadixColor =
  | "green" | "yellow" | "orange" | "red" | "gray";

export function formatLifecycleStatus(status: ModelLifecycleStatus) {
  switch (status) {
    case ModelLifecycleStatus.ACTIVE:
      return "Active";
    case ModelLifecycleStatus.LEGACY:
      return "Legacy";
    case ModelLifecycleStatus.DEPRECATED:
      return "Deprecated";
    case ModelLifecycleStatus.EOL:
      return "End of Life";
    case ModelLifecycleStatus.BLOCKED:
      return "Blocked";
    default:
      return "Unspecified";
  }
}

export function lifecycleStatusColor(status: ModelLifecycleStatus): RadixColor {
  switch (status) {
    case ModelLifecycleStatus.ACTIVE:
      return "green";
    case ModelLifecycleStatus.LEGACY:
      return "yellow";
    case ModelLifecycleStatus.DEPRECATED:
      return "orange";
    case ModelLifecycleStatus.EOL:
    case ModelLifecycleStatus.BLOCKED:
      return "red";
    default:
      return "gray";
  }
}

export function formatModelMetadataSummary(model: ModelVersion) {
  const vendor = model.vendorId ? `vendor ${model.vendorId}` : "unspecified vendor";
  return `Canonical model metadata for ${vendor}.`;
}
