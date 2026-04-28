import { create } from "@bufbuild/protobuf";
import {
  ModelRefSchema,
  type ModelRef,
} from "@code-code/agent-contract/model/v1";
import { ModelService, ModelListFilterSchema } from "@code-code/agent-contract/platform/model/v1";
import { connectClient } from "@code-code/console-web-ui";

import {
  type ProviderModelRegistryBindingDraft,
  type ProviderModelRegistryResolution,
} from "./api-types";

const modelBindingScanPageSize = 100;
const modelBindingScanMaxPages = 20;
const modelServiceClient = connectClient(ModelService);

export async function bindProviderModelsToRegistry(
  draft: ProviderModelRegistryBindingDraft
): Promise<ProviderModelRegistryResolution> {
  const normalizedVendorId = draft.vendorId?.trim() || "";
  const providerModelIds = Array.from(new Set(
    draft.providerModelIds
      .map((value) => normalizeProviderModelId(value))
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
  return {
    providerModelIds,
    modelRefByProviderModelId: boundModelRefs,
  };
}

// normalizeProviderModelId strips the "models/" prefix used by some providers
// (e.g. Google Gemini API) to align with canonical model identity.
function normalizeProviderModelId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("models/")
    ? trimmed.slice("models/".length).trim()
    : trimmed;
}

async function listRegistryModelsByVendor(vendorId: string, pageToken: string) {
  return modelServiceClient.listModels({
    pageSize: modelBindingScanPageSize,
    pageToken: pageToken.trim(),
    structuredFilter: create(ModelListFilterSchema, { vendorIds: [vendorId.trim()] })
  });
}
