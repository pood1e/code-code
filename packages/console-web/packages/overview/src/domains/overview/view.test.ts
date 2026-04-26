import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  CredentialStatusSchema,
  CredentialViewSchema,
  ProviderSurfaceBindingPhase,
  ProviderSurfaceBindingStatusSchema,
  ProviderSurfaceBindingViewSchema,
  ProviderViewSchema,
} from "@code-code/agent-contract/platform/management/v1";
import {
  collectOverviewIssues,
  summarizeCredentials,
  summarizeProviderAccounts,
} from "./view";

describe("overview view", () => {
  it("summarizes provider account readiness", () => {
    const summary = summarizeProviderAccounts([
      create(ProviderViewSchema, {
        providerId: "account-ready",
        displayName: "OpenAI",
        surfaces: [providerSurfaceBinding("READY")],
      }),
      create(ProviderViewSchema, {
        providerId: "account-alert",
        displayName: "Anthropic",
        surfaces: [providerSurfaceBinding("INVALID_CONFIG", "credential material is not ready")],
      }),
      create(ProviderViewSchema, {
        providerId: "account-unknown",
        displayName: "Gemini",
        surfaces: [],
      }),
    ]);

    expect(summary).toMatchObject({
      total: 3,
      ready: 1,
      attention: 1,
      unknown: 1,
    });
    expect(summary.issues).toMatchObject([{
      level: "red",
      title: "Provider · Anthropic",
      reason: "credential material is not ready",
      href: "/providers?account=account-alert",
      actionLabel: "Review Provider",
    }]);
  });

  it("summarizes credential readiness", () => {
    const summary = summarizeCredentials([
      create(CredentialViewSchema, {
        credentialId: "cred-ready",
        displayName: "Ready Key",
        status: create(CredentialStatusSchema, { materialReady: true }),
      }),
      create(CredentialViewSchema, {
        credentialId: "cred-alert",
        displayName: "Broken Key",
        status: create(CredentialStatusSchema, {
          materialReady: false,
          reason: "backing secret missing",
        }),
      }),
      create(CredentialViewSchema, {
        credentialId: "cred-unknown",
        displayName: "Pending Key",
      }),
    ]);

    expect(summary).toMatchObject({
      total: 3,
      ready: 1,
      attention: 1,
      unknown: 1,
    });
    expect(summary.issues).toMatchObject([{
      level: "red",
      title: "Credential · Broken Key",
      reason: "backing secret missing",
      href: "/providers?credential=cred-alert",
      actionLabel: "Review Authentication",
    }]);
  });

  it("sorts combined issues by severity then title", () => {
    const issues = collectOverviewIssues({
      total: 2,
      ready: 0,
      attention: 2,
      unknown: 0,
      issues: [
        { level: "amber", title: "Provider · Zeta", reason: "1/2 endpoints ready" },
        { level: "red", title: "Provider · Alpha", reason: "backing secret missing" },
      ],
    });

    expect(issues.map((item) => item.title)).toEqual([
      "Provider · Alpha",
      "Provider · Zeta",
    ]);
  });
});

function providerSurfaceBinding(phase: "READY" | "INVALID_CONFIG", reason = "") {
  return create(ProviderSurfaceBindingViewSchema, {
    surfaceId: `instance-${phase.toLowerCase()}`,
    status: create(ProviderSurfaceBindingStatusSchema, {
      phase: phase === "READY" ? ProviderSurfaceBindingPhase.READY : ProviderSurfaceBindingPhase.INVALID_CONFIG,
      reason,
    }),
  });
}
