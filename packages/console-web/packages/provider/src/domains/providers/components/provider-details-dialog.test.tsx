import { create } from "@bufbuild/protobuf";
import { Theme } from "@radix-ui/themes";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActiveQueryInputControl,
  ActiveQueryInputPersistence,
  ActiveQueryInputValueTransform,
} from "@code-code/agent-contract/observability/v1";
import {
  ProviderSurfaceBindingPhase,
  ProviderViewSchema,
  type ProviderView,
} from "@code-code/agent-contract/platform/management/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { ProviderProtocol } from "../provider-protocol";
import { ProviderDetailsDialog } from "./provider-details-dialog";

describe("ProviderDetailsDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows vendor session auth action from support metadata", () => {
    render(
      <Theme>
        <ProviderDetailsDialog
          provider={mistralProvider()}
          clis={[]}
          surfaces={[]}
          vendors={[mistralVendor()]}
          onClose={vi.fn()}
          onUpdated={vi.fn()}
          onProbeActiveQuery={vi.fn()}
        />
      </Theme>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Update Session Token" }));

    expect(screen.getByRole("heading", { name: "Update Mistral Session Token" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste Mistral session token")).toHaveAttribute("name", "values.access_token");
  });
});

function mistralProvider(): ProviderView {
  return create(ProviderViewSchema, {
    providerId: "mistral-ai",
    displayName: "Mistral AI",
    vendorId: "mistral",
    providerCredentialId: "mistral-api-key",
    surfaces: [{
      displayName: "Mistral OpenAI Compatible",
      surfaceId: "openai-compatible",
      providerCredentialId: "mistral-api-key",
      vendorId: "mistral",
      providerId: "mistral-ai",
      providerDisplayName: "Mistral AI",
      runtime: {
        displayName: "Mistral OpenAI Compatible",
        access: {
          case: "api",
          value: {
            protocol: ProviderProtocol.OPENAI_COMPATIBLE,
            baseUrl: "https://api.mistral.ai/v1",
          },
        },
      },
      status: {
        phase: ProviderSurfaceBindingPhase.READY,
      },
    }],
  });
}

function mistralVendor(): Vendor {
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
                fields: [{
                  $typeName: "observability.v1.ActiveQueryInputField",
                  fieldId: "access_token",
                  label: "Session token",
                  description: "",
                  placeholder: "Paste Mistral session token",
                  required: true,
                  sensitive: true,
                  control: ActiveQueryInputControl.PASSWORD,
    persistence: ActiveQueryInputPersistence.STORED_MATERIAL,
                  targetFieldId: "",
                  transform: ActiveQueryInputValueTransform.IDENTITY,
                  defaultValue: "",
                }],
              },
            },
          },
        }],
      },
    }],
  };
}
