import { describe, expect, it } from "vitest";
import { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import { ProviderProtocol } from "./provider-protocol";
import { providerConnectFormModel } from "./provider-connect-form-model";

describe("provider connect form model", () => {
  it("shows api key fields for vendor api key options", () => {
    expect(providerConnectFormModel({
      id: "vendor:cerebras",
      kind: "vendorApiKey",
      displayName: "Cerebras",
      vendorId: "cerebras",
      prefilledSurfaces: [],
    }, [], "").showAPIKeyFields()).toBe(true);

    expect(providerConnectFormModel({
      id: "cli:gemini",
      kind: "cliOAuth",
      displayName: "Gemini",
      cliId: "gemini",
      flow: OAuthAuthorizationFlow.CODE,
      recommended: true,
    }, [], "").showAPIKeyFields()).toBe(false);
  });

  it("includes gemini in custom api key protocol options", () => {
    const options = providerConnectFormModel({
      id: "custom-api-key",
      kind: "customApiKey",
      displayName: "Custom API Key",
    }, [], "").protocolOptions();

    expect(options.map((item) => item.value)).toContain(String(ProviderProtocol.GEMINI));
  });
});
