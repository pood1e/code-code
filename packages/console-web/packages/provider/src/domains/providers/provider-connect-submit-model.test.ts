import { create } from "@bufbuild/protobuf";
import {
  ConnectProviderResponseSchema,
  ProviderViewSchema,
} from "@code-code/agent-contract/platform/management/v1";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectProviderWithVendorAPIKey } from "./api";
import { type ProviderConnectFormValues } from "./provider-connect-form-model";
import { confirmProviderAPIKeyConnect } from "./provider-connect-submit-model";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    connectProviderWithVendorAPIKey: vi.fn(),
  };
});

const connectProviderWithVendorAPIKeyMock = vi.mocked(connectProviderWithVendorAPIKey);

describe("provider connect submit model", () => {
  beforeEach(() => {
    connectProviderWithVendorAPIKeyMock.mockReset();
  });

  it("forwards api key vendor connect payload", async () => {
    connectProviderWithVendorAPIKeyMock.mockResolvedValue(create(ConnectProviderResponseSchema, {
      outcome: {
        case: "provider",
        value: create(ProviderViewSchema, { providerId: "provider-openai" }),
      },
    }));

    const provider = await confirmProviderAPIKeyConnect(
      {
        id: "vendor:openai",
        kind: "vendorApiKey",
        displayName: "OpenAI",
        vendorId: "openai",
        prefilledSurfaces: [],
      },
      {
        connectOptionId: "vendor:openai",
        displayName: "OpenAI",
        apiKey: "sk-openai",
        baseUrl: "",
        protocol: "",
      } satisfies ProviderConnectFormValues,
    );

    expect(connectProviderWithVendorAPIKeyMock).toHaveBeenCalledWith(expect.objectContaining({
      vendorId: "openai",
      apiKey: "sk-openai",
    }));
    expect(provider?.providerId).toBe("provider-openai");
  });
});
