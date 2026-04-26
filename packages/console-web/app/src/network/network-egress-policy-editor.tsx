import { useEffect, useState } from "react";
import { Badge, Button, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { FormTextField, InlineSelect } from "@code-code/console-web-ui";
import { saveEgressPolicy } from "./api";
import { ProxyEditor } from "./network-egress-proxy-editor";
import { badgeStyle, rowStyle, WrappingCode } from "./network-egress-policy-rows";
import { RuleSetEditor } from "./network-egress-ruleset-editor";
import { actionStrategyItems } from "./network-egress-strategy-options";
import type { EgressAction, IstioEgressPolicy, EgressRule, EgressProxy } from "./network-types";

type Props = {
  policy?: IstioEgressPolicy;
  onChanged: () => void | Promise<unknown>;
};

export function EgressPolicyEditor({ policy, onChanged }: Props) {
  const [draft, setDraft] = useState<IstioEgressPolicy | undefined>(() => clonePolicy(policy));
  const [host, setHost] = useState("");
  const [action, setAction] = useState<EgressAction>("proxy");
  const [ruleProxyID, setRuleProxyID] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const proxies = draft?.proxies ?? [];
  const proxyItems = proxies.map((proxy) => ({ value: proxy.id, label: proxy.name }));
  const firstProxyID = proxies[0]?.id ?? "";
  const selectedRuleProxyID = ruleProxyID || firstProxyID;

  useEffect(() => setDraft(clonePolicy(policy)), [policy]);
  useEffect(() => {
    const proxyIDs = new Set(proxies.map((proxy) => proxy.id));
    setRuleProxyID((current) => current && proxyIDs.has(current) ? current : firstProxyID);
    setAction((current) => current === "proxy" && !firstProxyID ? "direct" : current);
  }, [firstProxyID, proxies]);

  const canSave = Boolean(draft) && !saving;

  if (!draft) {
    return null;
  }

  async function save(options?: { refresh?: boolean; mode?: "apply" | "reload" }) {
    if (!draft) {
      return;
    }
    const refresh = options?.refresh ?? true;
    const mode = options?.mode ?? "apply";
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const saved = await saveEgressPolicy(draft);
      setDraft(clonePolicy(saved));
      if (mode === "reload") {
        setSaveMessage("External AutoProxy rule set reloaded.");
      } else {
        setSaveMessage("Policy applied.");
      }
      if (refresh) {
        await onChanged();
      }
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    const parsedMatch = parseRuleHostInput(host);
    if (!parsedMatch) {
      return;
    }
    if (action === "proxy" && !selectedRuleProxyID) {
      return;
    }
    const rule: EgressRule = {
      id: `custom-${parsedMatch.value.replace(/[^a-z0-9-]+/g, "-")}`,
      name: parsedMatch.value,
      match: parsedMatch.value,
      matchKind: parsedMatch.kind,
      action,
      proxyId: action === "proxy" ? selectedRuleProxyID : ""
    };
    setDraft((current) => current ? { ...current, rules: [...(current.rules ?? []), rule] } : current);
    setHost("");
  }

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Heading as="h2" size="3" weight="medium">Edit user strategy</Heading>
          <Button size="2" onClick={() => save({ refresh: true, mode: "apply" })} disabled={!canSave}>
            {saving ? "Saving..." : "Apply"}
          </Button>
        </Flex>
        {saveError ? <Text size="2" color="red">{saveError}</Text> : null}
        {!saveError && saveMessage ? <Text size="2" color="green">{saveMessage}</Text> : null}

        <ProxyEditor policy={draft} onChange={setDraft} />
        <RuleSetEditor
          policy={draft}
          onChange={setDraft}
          onReload={() => save({ refresh: false, mode: "reload" })}
          reloading={saving}
          proxyItems={proxyItems}
        />

        <Flex direction="column" gap="3">
          <Heading as="h3" size="2" weight="medium">Custom rules</Heading>
          <Grid columns={{ initial: "1", md: "minmax(0, 1fr) 120px 160px 96px" }} gap="2" align="end">
            <FormTextField label="Host" value={host} onValueChange={setHost} placeholder="api.example.com or *.example.com" />
            <InlineSelect value={action} items={actionStrategyItems(proxies.length > 0)} onValueChange={(value) => setAction(value as EgressAction)} ariaLabel="Custom rule action" />
            <InlineSelect
              value={selectedRuleProxyID}
              items={proxyItems}
              disabled={action !== "proxy" || proxies.length === 0}
              onValueChange={setRuleProxyID}
              ariaLabel="Custom rule proxy"
            />
            <Button variant="soft" onClick={addRule}>Add</Button>
          </Grid>
          <Flex direction="column">
            {(draft.rules ?? []).map((rule, index) => (
              <Grid key={`${rule.id}-${index}`} columns={{ initial: "1", md: "72px 160px minmax(0, 1fr) 72px" }} gap="2" style={rowStyle}>
                <Badge color={actionColor(rule.action)} variant="soft" style={badgeStyle}>{rule.action}</Badge>
                <Text size="2" color="gray">{rule.action === "proxy" ? proxyName(proxies, rule.proxyId) : "direct"}</Text>
                <WrappingCode>{rule.match}</WrappingCode>
                <Button variant="ghost" color="red" onClick={() => removeRule(index)}>Remove</Button>
              </Grid>
            ))}
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );

  function removeRule(index: number) {
    setDraft((current) => current ? { ...current, rules: (current.rules ?? []).filter((_, i) => i !== index) } : current);
  }
}

function actionColor(action: EgressAction) {
  if (action === "proxy") {
    return "blue";
  }
  return "green";
}

function clonePolicy(policy: IstioEgressPolicy | undefined): IstioEgressPolicy | undefined {
  return policy ? normalizeProxyReferences({
    ...policy,
    proxies: policy.proxies?.map((proxy) => ({ ...proxy })),
    rules: policy.rules?.map((rule) => ({ ...rule })),
    externalRuleSet: { ...policy.externalRuleSet },
    externalRuleSetStatus: { ...policy.externalRuleSetStatus }
  }) : undefined;
}

function normalizeProxyReferences(policy: IstioEgressPolicy): IstioEgressPolicy {
  const proxyIDs = new Set((policy.proxies ?? []).map((proxy) => proxy.id));
  return {
    ...policy,
    rules: policy.rules?.map((rule) => normalizeRuleProxy(rule, proxyIDs)),
    externalRuleSet: normalizeExternalRuleSetProxy(policy.externalRuleSet, proxyIDs)
  };
}

function normalizeRuleProxy(rule: EgressRule, proxyIDs: Set<string>): EgressRule {
  if (rule.action !== "proxy" || proxyIDs.has(rule.proxyId)) {
    return rule;
  }
  return { ...rule, action: "direct", proxyId: "" };
}

function normalizeExternalRuleSetProxy(
  ruleSet: IstioEgressPolicy["externalRuleSet"],
  proxyIDs: Set<string>
): IstioEgressPolicy["externalRuleSet"] {
  if (ruleSet.action !== "proxy" || proxyIDs.has(ruleSet.proxyId)) {
    return ruleSet;
  }
  return { ...ruleSet, action: "direct", proxyId: "" };
}

function proxyName(proxies: EgressProxy[], proxyID: string) {
  return proxies.find((proxy) => proxy.id === proxyID)?.name ?? proxyID;
}

function parseRuleHostInput(value: string): { kind: EgressRule["matchKind"]; value: string } | undefined {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("*.") || normalized.startsWith(".")) {
    const suffix = normalized.replace(/^\*\./, "").replace(/^\./, "");
    if (!suffix || suffix.includes("*")) {
      return undefined;
    }
    return { kind: "hostSuffix", value: `*.${suffix}` };
  }
  if (normalized.includes("*")) {
    return undefined;
  }
  return { kind: "hostExact", value: normalized };
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Save failed.";
}
