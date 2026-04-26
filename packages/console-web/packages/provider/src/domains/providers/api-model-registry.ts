import { create } from "@bufbuild/protobuf";
import {
  ModelRefSchema,
  Modality,
  type ModelDefinition,
  type ModelRef,
} from "@code-code/agent-contract/model/v1";
import { ModelService } from "@code-code/agent-contract/platform/model/v1";
import { connectClient } from "@code-code/console-web-ui";

import {
  type ProviderModelRegistryBindingDraft,
  type ProviderModelRegistryResolution,
} from "./api-types";

const modelBindingScanPageSize = 100;
const modelBindingScanMaxPages = 20;
const modelServiceClient = connectClient(ModelService);
const temporarilyDisabledGoogleModelIds = new Set([
  "gemini-3-pro-image-preview",
  "nano-banana-pro-preview",
  "lyria-3-clip-preview",
  "lyria-3-pro-preview",
  "gemini-robotics-er-1.5-preview",
  "gemini-robotics-er-1.6-preview",
  "gemini-2.5-computer-use-preview-10-2025",
  "deep-research-pro-preview-12-2025",
  "gemini-embedding-001",
  "gemini-embedding-2-preview",
  "aqa",
]);

export async function bindProviderModelsToRegistry(
  draft: ProviderModelRegistryBindingDraft
): Promise<ProviderModelRegistryResolution> {
  const normalizedVendorId = draft.vendorId?.trim() || "";
  const isGoogleVendor = normalizedVendorId.toLowerCase() === "google";
  const providerModelIds = Array.from(new Set(
    draft.providerModelIds
      .map((value) => normalizeProviderModelId(value, isGoogleVendor))
      .filter(Boolean)
  ));
  if (!providerModelIds.length) {
    return {
      providerModelIds: [],
      modelRefByProviderModelId: {},
    };
  }
  if (!normalizedVendorId) {
    return {
      providerModelIds,
      modelRefByProviderModelId: {},
    };
  }
  const boundModelRefs: Record<string, ModelRef> = {};
  const blockedGoogleProviderModelIds = new Set<string>();
  const missingModelIds = new Set(providerModelIds);
  let pageToken = "";
  for (let page = 0; page < modelBindingScanMaxPages; page += 1) {
    const response = await listRegistryModelsByVendor(normalizedVendorId, pageToken);
    for (const item of response.items) {
      const definition = item.definition;
      const modelId = (definition?.modelId || "").trim();
      const vendorId = (definition?.vendorId || "").trim();
      if (!modelId || !vendorId || vendorId !== normalizedVendorId || !missingModelIds.has(modelId)) {
        continue;
      }
      if (isGoogleVendor && isTemporarilyDisabledGoogleMediaModel(definition)) {
        blockedGoogleProviderModelIds.add(modelId);
        missingModelIds.delete(modelId);
        continue;
      }
      if (isGoogleVendor && !supportsGoogleTextModel(definition)) {
        continue;
      }
      boundModelRefs[modelId] = create(ModelRefSchema, {
        vendorId,
        modelId,
      });
      missingModelIds.delete(modelId);
    }
    if (!response.nextPageToken || missingModelIds.size === 0) {
      break;
    }
    pageToken = response.nextPageToken;
  }
  const filteredGoogleProviderModelIds = isGoogleVendor
    ? providerModelIds.filter((modelId) => (
      !blockedGoogleProviderModelIds.has(modelId)
      && !isTemporarilyDisabledGoogleMediaModelIdentity(modelId, "")
    ))
    : providerModelIds;
  return {
    providerModelIds: filteredGoogleProviderModelIds,
    modelRefByProviderModelId: boundModelRefs,
  };
}

function normalizeProviderModelId(value: string, stripGeminiModelsPrefix: boolean) {
  const trimmed = value.trim();
  if (!stripGeminiModelsPrefix) {
    return trimmed;
  }
  return trimmed.startsWith("models/")
    ? trimmed.slice("models/".length).trim()
    : trimmed;
}

async function listRegistryModelsByVendor(vendorId: string, pageToken: string) {
  return modelServiceClient.listModelDefinitions({
    pageSize: modelBindingScanPageSize,
    pageToken: pageToken.trim(),
    filter: buildVendorFilter(vendorId)
  });
}

function buildVendorFilter(vendorId: string) {
  return `vendor_id=${sanitizeFilterValue(vendorId)}`;
}

function sanitizeFilterValue(value: string) {
  return value.trim().replace(/[,\n\r]+/g, " ").replace(/\bAND\b/gi, " ");
}

function supportsGoogleTextModel(definition?: ModelDefinition) {
  const outputModalities = definition?.outputModalities ?? [];
  return outputModalities.length > 0
    && outputModalities.every((modality) => modality === Modality.TEXT);
}

function isTemporarilyDisabledGoogleMediaModel(definition?: ModelDefinition) {
  const modelId = (definition?.modelId || "").trim().toLowerCase();
  const displayName = (definition?.displayName || "").trim().toLowerCase();
  return isTemporarilyDisabledGoogleMediaModelIdentity(modelId, displayName);
}

function isTemporarilyDisabledGoogleMediaModelIdentity(modelId: string, displayName: string) {
  const normalizedModelId = modelId.trim().toLowerCase().replace(/^models\//, "");
  if (temporarilyDisabledGoogleModelIds.has(normalizedModelId)) {
    return true;
  }
  const identity = `${normalizedModelId} ${displayName.trim().toLowerCase()}`.trim();
  if (!identity) {
    return false;
  }
  const blockedKeywords = [
    "imagen",
    "veo",
    "audio",
    "speech",
    "tts",
    "stt",
    "lyria",
    "robotics",
    "computer-use",
    "embedding",
    "deep-research",
    "aqa",
    "flash-image",
    "nano banana",
  ];
  return blockedKeywords.some((keyword) => identity.includes(keyword));
}
