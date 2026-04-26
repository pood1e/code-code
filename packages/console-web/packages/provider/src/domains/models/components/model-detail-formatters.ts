import {
  AliasKind,
  ModelCapability,
  ModelShape,
  Modality,
  type ModelDefinition,
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

export function formatModelMetadataSummary(model: ModelDefinition) {
  const vendor = model.vendorId ? `vendor ${model.vendorId}` : "unspecified vendor";
  return `Canonical model metadata for ${vendor}.`;
}
