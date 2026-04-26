import { type ProviderView } from "@code-code/agent-contract/platform/management/v1";
import {
  connectProviderWithCustomAPIKey,
  connectProviderWithOAuth,
  connectProviderWithVendorAPIKey,
} from "./api";
import {
  isCLIOAuthConnectOption,
  isCustomAPIKeyConnectOption,
  isVendorAPIKeyConnectOption,
  parseProtocolValue,
  type ProviderConnectOption,
} from "./provider-connect-options";
import { type ProviderConnectFormValues } from "./provider-connect-form-model";
export async function startProviderOAuthConnect(
  selectedOption: ProviderConnectOption | undefined,
  data: ProviderConnectFormValues,
) {
  if (!selectedOption || !isCLIOAuthConnectOption(selectedOption)) {
    throw new Error("Unsupported provider connect option.");
  }
  const response = await connectProviderWithOAuth({
    cliId: selectedOption.cliId,
    displayName: data.displayName,
  });
  if (response.outcome.case !== "session") {
    throw new Error("Provider connect did not return a session.");
  }
  return {
    session: response.outcome.value,
    optionKind: selectedOption.kind,
    flow: selectedOption.flow,
  };
}

export async function confirmProviderAPIKeyConnect(
  selectedOption: ProviderConnectOption | undefined,
  data: ProviderConnectFormValues,
): Promise<ProviderView | undefined> {
  if (!selectedOption) {
    return undefined;
  }
  if (!isVendorAPIKeyConnectOption(selectedOption) && !isCustomAPIKeyConnectOption(selectedOption)) {
    throw new Error("Unsupported provider connect option.");
  }
  const response = isVendorAPIKeyConnectOption(selectedOption)
    ? await connectProviderWithVendorAPIKey({
      vendorId: selectedOption.vendorId,
      displayName: data.displayName,
      apiKey: data.apiKey,
    })
    : await connectProviderWithCustomAPIKey({
      displayName: data.displayName,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      protocol: parseProtocolValue(data.protocol),
    });
  return response.outcome.case === "provider" ? response.outcome.value : undefined;
}
