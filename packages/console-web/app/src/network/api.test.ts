import { describe, expect, it, vi, afterEach } from "vitest";
import { saveEgressPolicy } from "./api";
import type { IstioEgressPolicy } from "./network-types";

describe("network egress api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes the single external AutoProxy rule set", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await saveEgressPolicy(testPolicy());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/network/egress-policies/default",
      expect.objectContaining({ method: "PUT" })
    );
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "")) as { policy?: { externalRuleSet?: unknown; ruleSets?: unknown } };

    expect(body.policy?.externalRuleSet).toEqual({
      sourceUrl: "https://example.com/gfwlist.txt",
      enabled: true,
      action: "EGRESS_ACTION_PROXY",
      proxyId: "local"
    });
    expect(body.policy?.ruleSets).toBeUndefined();
  });

  it("serializes wildcard host input as hostSuffix", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const policy = testPolicy();
    policy.rules = [{
      id: "suffix",
      name: "*.example.com",
      match: "*.example.com",
      matchKind: "hostSuffix",
      action: "direct",
      proxyId: ""
    }];

    await saveEgressPolicy(policy);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "")) as { policy?: { customRules?: Array<{ match?: { hostSuffix?: string } }> } };
    expect(body.policy?.customRules?.[0]?.match).toEqual({ hostSuffix: "example.com" });
  });
});

function testPolicy(): IstioEgressPolicy {
  return {
    id: "default",
    displayName: "Default",
    owner: "istio",
    sync: {
      status: "synced",
      reason: "",
      observedGeneration: 1,
      targetGateway: { kind: "Gateway", namespace: "net", name: "egress" },
      appliedResources: []
    },
    configuredBy: {
      kind: "service",
      id: "default",
      displayName: "Default",
      crdKind: "ConfigMap"
    },
    proxies: [{ id: "local", name: "Local", endpoint: "http://127.0.0.1:10809", protocol: "http" }],
    rules: [],
    externalRuleSet: {
      sourceUrl: "https://example.com/gfwlist.txt",
      enabled: true,
      action: "proxy",
      proxyId: "local"
    },
    externalRuleSetStatus: {
      phase: "loaded",
      sourceUrl: "https://example.com/gfwlist.txt",
      loadedHostCount: 2,
      skippedRuleCount: 1,
      message: "loaded"
    },
    consumers: []
  };
}
