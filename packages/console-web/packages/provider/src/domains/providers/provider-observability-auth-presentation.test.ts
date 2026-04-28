import {
  ActiveQueryInputControl,
  ActiveQueryInputPersistence,
  ActiveQueryInputValueTransform,
} from "@code-code/agent-contract/observability/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { describe, expect, it } from "vitest";
import { providerObservabilityAuthPresentation } from "./provider-observability-auth-presentation";

describe("provider observability auth presentation", () => {
  it("derives the form from vendor support metadata", () => {
    const presentation = providerObservabilityAuthPresentation("mistral", [vendorWithForm()]);

    expect(presentation?.schemaId).toBe("mistral-billing-session");
    expect(presentation?.fieldLabel).toBe("Session token");
    expect(presentation?.providerActionLabel).toBe("Update Session Token");
    expect(presentation?.requiredKeys).toEqual(["access_token"]);
    expect(presentation?.fields[0]).toMatchObject({
      key: "access_token",
      sensitive: true,
    persistence: ActiveQueryInputPersistence.STORED_MATERIAL,
    });
  });

  it("preserves transient transform metadata for generic form submission", () => {
    const presentation = providerObservabilityAuthPresentation("mistral", [vendorWithForm()]);
    const field = presentation?.fields.find((item) => item.key === "response_set_cookie");

    expect(field).toMatchObject({
      key: "response_set_cookie",
      targetFieldId: "cookie",
      transform: ActiveQueryInputValueTransform.MERGE_SET_COOKIE,
      persistence: ActiveQueryInputPersistence.TRANSIENT,
    });
  });

  it("returns null when support metadata does not declare an input form", () => {
    expect(providerObservabilityAuthPresentation("minimax", [])).toBeNull();
  });
});

function vendorWithForm(): Vendor {
  return {
    $typeName: "platform.support.v1.Vendor",
    vendor: {
      $typeName: "vendor_definition.v1.Vendor",
      vendorId: "mistral",
      displayName: "Mistral",
      aliases: [],
      iconUrl: "",
      websiteUrl: "",
      description: "",
    },
    providerBindings: [{
      $typeName: "platform.support.v1.VendorProviderBinding",
      providerBinding: {
        $typeName: "platform.support.v1.ProviderSurfaceBinding",
        surfaceId: "openai-compatible",
        modelCatalogProbeId: "",
        quotaProbeId: "",
        egressPolicyId: "",
        headerRewritePolicyId: "",
      },
      surfaceTemplates: [],
      observability: {
        $typeName: "observability.v1.ObservabilityCapability",
        profiles: [{
          $typeName: "observability.v1.ObservabilityProfile",
          profileId: "billing",
          displayName: "Billing",
          scopeIds: [],
          metrics: [],
          metricQueries: [],
          collection: {
            case: "activeQuery",
            value: {
              $typeName: "observability.v1.ActiveQueryCollection",
              collectorId: "mistral-billing",
              dynamicParameters: [],
              credentialBackfills: [],
              inputForm: {
                $typeName: "observability.v1.ActiveQueryInputForm",
                schemaId: "mistral-billing-session",
                title: "Update Mistral Session Token",
                actionLabel: "Update Session Token",
                description: "Paste the session token.",
                fields: [
                  {
                    $typeName: "observability.v1.ActiveQueryInputField",
                    fieldId: "access_token",
                    label: "Session token",
                    description: "",
                    placeholder: "Paste session token",
                    required: true,
                    sensitive: true,
                    control: ActiveQueryInputControl.PASSWORD,
    persistence: ActiveQueryInputPersistence.STORED_MATERIAL,
                    targetFieldId: "",
                    transform: ActiveQueryInputValueTransform.IDENTITY,
                    defaultValue: "",
                  },
                  {
                    $typeName: "observability.v1.ActiveQueryInputField",
                    fieldId: "cookie",
                    label: "Request Cookie",
                    description: "",
                    placeholder: "Paste request Cookie header",
                    required: false,
                    sensitive: true,
                    control: ActiveQueryInputControl.TEXTAREA,
    persistence: ActiveQueryInputPersistence.STORED_MATERIAL,
                    targetFieldId: "",
                    transform: ActiveQueryInputValueTransform.IDENTITY,
                    defaultValue: "",
                  },
                  {
                    $typeName: "observability.v1.ActiveQueryInputField",
                    fieldId: "response_set_cookie",
                    label: "Response Set-Cookie",
                    description: "",
                    placeholder: "",
                    required: false,
                    sensitive: false,
                    control: ActiveQueryInputControl.TEXTAREA,
                    persistence: ActiveQueryInputPersistence.TRANSIENT,
                    targetFieldId: "cookie",
                    transform: ActiveQueryInputValueTransform.MERGE_SET_COOKIE,
                    defaultValue: "",
                  },
                ],
              },
            },
          },
        }],
      },
    }],
  };
}
