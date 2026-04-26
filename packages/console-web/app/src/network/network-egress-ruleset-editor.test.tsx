import { Theme } from "@radix-ui/themes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuleSetEditor } from "./network-egress-ruleset-editor";
import type { IstioEgressPolicy } from "./network-types";

describe("RuleSetEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("edits one external AutoProxy URL and exposes reload", () => {
    const onChange = vi.fn();
    const onReload = vi.fn();

    render(
      <Theme>
        <RuleSetEditor
          policy={testPolicy()}
          onChange={onChange}
          onReload={onReload}
          proxyItems={[{ value: "local", label: "Local" }]}
        />
      </Theme>
    );

    fireEvent.change(screen.getByLabelText("AutoProxy URL"), {
      target: { value: "https://example.com/updated.txt" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      externalRuleSet: expect.objectContaining({ sourceUrl: "https://example.com/updated.txt" })
    }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("3 hosts / 1 skipped")).toBeInTheDocument();
  });

  it("toggles the single external rule set", () => {
    const onChange = vi.fn();

    render(
      <Theme>
        <RuleSetEditor
          policy={testPolicy()}
          onChange={onChange}
          onReload={vi.fn()}
          proxyItems={[]}
        />
      </Theme>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      externalRuleSet: expect.objectContaining({ enabled: false })
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
      loadedHostCount: 3,
      skippedRuleCount: 1,
      message: "AutoProxy rule set loaded"
    },
    consumers: []
  };
}
