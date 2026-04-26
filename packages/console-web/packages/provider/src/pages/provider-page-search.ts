import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderConnectOptionKind } from "../domains/providers/provider-connect-options";

export type ProviderPageSearchState = {
  connectSessionId?: string;
  connectKind?: ProviderConnectOptionKind;
  providerId?: string;
  credentialId?: string;
};

type ProviderPageSearchPatch = Partial<ProviderPageSearchState>;

const providerPageParam = {
  connectSessionId: "connectSession",
  connectKind: "connectKind",
  providerId: "provider",
  credentialId: "credential",
} as const;

export function readProviderPageSearchState(searchParams: URLSearchParams): ProviderPageSearchState {
  return {
    connectSessionId: readTrimmedParam(searchParams, providerPageParam.connectSessionId),
    connectKind: parseProviderAddKind(readTrimmedParam(searchParams, providerPageParam.connectKind)),
    providerId: readTrimmedParam(searchParams, providerPageParam.providerId),
    credentialId: readTrimmedParam(searchParams, providerPageParam.credentialId),
  };
}

export function buildProviderPageSearchParams(
  searchParams: URLSearchParams,
  patch: ProviderPageSearchPatch,
) {
  const next = new URLSearchParams(searchParams);
  applyPatchValue(next, providerPageParam.connectSessionId, patch, "connectSessionId");
  applyPatchValue(next, providerPageParam.connectKind, patch, "connectKind");
  applyPatchValue(next, providerPageParam.providerId, patch, "providerId");
  applyPatchValue(next, providerPageParam.credentialId, patch, "credentialId");
  return next;
}

export function resolveFocusedProvider(
  providers: ProviderView[],
  searchState: Pick<ProviderPageSearchState, "providerId" | "credentialId">,
) {
  if (searchState.providerId) {
    return providers.find((provider) => provider.providerId === searchState.providerId);
  }
  if (searchState.credentialId) {
    return providers.find((provider) => provider.providerCredentialId === searchState.credentialId);
  }
  return undefined;
}

function applyPatchValue(
  searchParams: URLSearchParams,
  searchKey: string,
  patch: ProviderPageSearchPatch,
  patchKey: keyof ProviderPageSearchPatch,
) {
  if (!Object.prototype.hasOwnProperty.call(patch, patchKey)) {
    return;
  }
  const value = patch[patchKey];
  if (value) {
    searchParams.set(searchKey, value);
    return;
  }
  searchParams.delete(searchKey);
}

function readTrimmedParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim() ?? "";
  return value || undefined;
}

function parseProviderAddKind(value?: string): ProviderConnectOptionKind | undefined {
  switch (value) {
    case "vendorApiKey":
    case "customApiKey":
    case "cliOAuth":
      return value;
    default:
      return undefined;
  }
}
