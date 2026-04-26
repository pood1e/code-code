import { Badge, Button, Flex, Grid, Heading, Switch, Text } from "@radix-ui/themes";
import { FormTextField, InlineSelect } from "@code-code/console-web-ui";
import { rowStyle, wrapTextStyle } from "./network-egress-policy-rows";
import { routeStrategyItems } from "./network-egress-strategy-options";
import type { EgressAction, ExternalRuleSetLoadPhase, IstioEgressPolicy } from "./network-types";

type Props = {
  policy: IstioEgressPolicy;
  onChange: (policy: IstioEgressPolicy) => void;
  onReload: () => void | Promise<unknown>;
  reloading?: boolean;
  proxyItems: { value: string; label: string }[];
};

export function RuleSetEditor({ policy, onChange, onReload, reloading, proxyItems }: Props) {
  const ruleSet = policy.externalRuleSet;
  const status = policy.externalRuleSetStatus;
  const hasProxy = proxyItems.length > 0;
  const action = ruleSet.action === "proxy" && !hasProxy ? "direct" : ruleSet.action;
  const selectedProxyID = ruleSet.proxyId || proxyItems[0]?.value || "";
  const canReload = !reloading && (!ruleSet.enabled || Boolean(ruleSet.sourceUrl.trim())) && (action !== "proxy" || Boolean(selectedProxyID));

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex direction="column" gap="1">
          <Heading as="h3" size="2" weight="medium">External AutoProxy rule set</Heading>
          <Text size="2" color="gray">One ZeroOmega-compatible URL can be loaded into Istio egress.</Text>
        </Flex>
        <Button variant="soft" onClick={onReload} disabled={!canReload}>
          {reloading ? "Reloading..." : "Reload"}
        </Button>
      </Flex>

      <Grid columns={{ initial: "1", md: "96px minmax(0, 1fr) 120px 150px" }} gap="2" align="end">
        <Flex direction="column" gap="2">
          <Text as="label" size="1" color="gray" htmlFor="external-ruleset-enabled">Enabled</Text>
          <Switch
            id="external-ruleset-enabled"
            checked={ruleSet.enabled}
            onCheckedChange={(enabled) => onChange(updateExternalRuleSet(policy, { enabled }))}
          />
        </Flex>
        <FormTextField
          label="AutoProxy URL"
          id="external-ruleset-url"
          value={ruleSet.sourceUrl}
          onValueChange={(sourceUrl) => onChange(updateExternalRuleSet(policy, { sourceUrl }))}
          placeholder="https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt"
        />
        <InlineSelect
          value={action}
          items={routeStrategyItems(hasProxy)}
          onValueChange={(value) => onChange(updateExternalRuleSetAction(policy, value as EgressAction, selectedProxyID))}
          ariaLabel="External rule set strategy"
        />
        <InlineSelect
          value={selectedProxyID}
          items={proxyItems}
          disabled={!ruleSet.enabled || action !== "proxy" || !hasProxy}
          onValueChange={(proxyId) => onChange(updateExternalRuleSet(policy, { proxyId }))}
          ariaLabel="External rule set proxy"
        />
      </Grid>

      <Grid columns={{ initial: "1", md: "120px minmax(0, 1fr)" }} gap="2" style={rowStyle}>
        <Badge color={statusColor(status.phase)} variant="soft">{statusLabel(status.phase)}</Badge>
        <Flex direction="column" gap="1">
          <Text size="2" color={status.phase === "failed" ? "red" : "gray"} style={wrapTextStyle}>
            {status.message || "No external rule set has been loaded."}
          </Text>
          <Text size="2" color="gray">
            {status.loadedHostCount} hosts / {status.skippedRuleCount} skipped{status.loadedAt ? ` / ${status.loadedAt}` : ""}
          </Text>
        </Flex>
      </Grid>
    </Flex>
  );
}

function updateExternalRuleSet(policy: IstioEgressPolicy, patch: Partial<IstioEgressPolicy["externalRuleSet"]>): IstioEgressPolicy {
  const next = { ...policy.externalRuleSet, ...patch };
  if (next.action !== "proxy") {
    next.proxyId = "";
  }
  return { ...policy, externalRuleSet: next };
}

function updateExternalRuleSetAction(policy: IstioEgressPolicy, action: EgressAction, proxyId: string): IstioEgressPolicy {
  return updateExternalRuleSet(policy, {
    enabled: true,
    action,
    proxyId: action === "proxy" ? proxyId : ""
  });
}

function statusLabel(phase: ExternalRuleSetLoadPhase) {
  if (phase === "loaded") {
    return "loaded";
  }
  if (phase === "failed") {
    return "failed";
  }
  if (phase === "not-loaded") {
    return "not loaded";
  }
  return "off";
}

function statusColor(phase: ExternalRuleSetLoadPhase) {
  if (phase === "loaded") {
    return "green";
  }
  if (phase === "failed") {
    return "red";
  }
  if (phase === "not-loaded") {
    return "amber";
  }
  return "gray";
}
