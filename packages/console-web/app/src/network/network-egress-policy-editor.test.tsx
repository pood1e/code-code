import { Theme } from "@radix-ui/themes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EgressPolicyEditor } from "./network-egress-policy-editor";
import type { IstioEgressPolicy } from "./network-types";

const saveEgressPolicy = vi.fn(async (_policy: unknown) => undefined);

vi.mock("./api", () => ({
  saveEgressPolicy: (policy: unknown) => saveEgressPolicy(policy)
}));

describe("EgressPolicyEditor", () => {
  afterEach(() => {
    cleanup();
    saveEgressPolicy.mockClear();
  });

  it("keeps custom rule inputs minimal", async () => {
    render(
      <Theme>
        <EgressPolicyEditor policy={testPolicy()} onChanged={vi.fn()} />
      </Theme>
    );

    expect(screen.queryByLabelText("Custom rule TLS mode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom rule HTTP protocol")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom rule WebSocket upgrade")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("api.example.com or *.example.com"), { target: { value: "api.example.com" } });
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(saveEgressPolicy).toHaveBeenCalledWith(expect.objectContaining({
      rules: expect.arrayContaining([expect.objectContaining({
        match: "api.example.com",
        action: "proxy",
        proxyId: "preset-proxy"
      })])
    }));
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
    proxies: [{ id: "preset-proxy", name: "Preset HTTP Proxy", endpoint: "http://127.0.0.1:10809", protocol: "http" }],
    rules: [],
    externalRuleSet: {
      sourceUrl: "",
      enabled: false,
      action: "direct",
      proxyId: ""
    },
    externalRuleSetStatus: {
      phase: "disabled",
      sourceUrl: "",
      loadedHostCount: 0,
      skippedRuleCount: 0,
      message: "disabled"
    },
    consumers: []
  };
}
