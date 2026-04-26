import { useState } from "react";
import { Button, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { FormTextField } from "@code-code/console-web-ui";
import { rowStyle } from "./network-egress-policy-rows";
import type { IstioEgressPolicy, EgressProxy } from "./network-types";

type Props = {
  policy: IstioEgressPolicy;
  onChange: (policy: IstioEgressPolicy) => void;
};

export function ProxyEditor({ policy, onChange }: Props) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const proxies = policy.proxies ?? [];

  function addProxy() {
    const proxyName = name.trim();
    const proxyEndpoint = endpoint.trim();
    if (!proxyName || !proxyEndpoint) {
      return;
    }
    const proxy: EgressProxy = {
      id: uniqueProxyID(proxies, proxyName),
      name: proxyName,
      endpoint: proxyEndpoint,
      protocol: "http"
    };
    onChange({ ...policy, proxies: [...proxies, proxy] });
    setName("");
    setEndpoint("");
  }

  return (
    <Flex direction="column" gap="3">
      <Heading as="h3" size="2" weight="medium">Proxies</Heading>
      <Flex direction="column">
        {proxies.map((proxy, index) => (
          <Grid key={proxy.id} columns={{ initial: "1", md: "160px minmax(0, 1fr) 80px" }} gap="2" style={rowStyle}>
            <FormTextField label="Name" value={proxy.name} onValueChange={(value) => onChange(updateProxy(policy, index, { name: value }))} />
            <FormTextField label="URL" value={proxy.endpoint} onValueChange={(value) => onChange(updateProxy(policy, index, { endpoint: value }))} />
            <Button variant="ghost" color="red" onClick={() => onChange(removeProxy(policy, proxy.id))}>Remove</Button>
          </Grid>
        ))}
      </Flex>
      <Grid columns={{ initial: "1", md: "160px minmax(0, 1fr) 96px" }} gap="2" align="end">
        <FormTextField label="Name" value={name} onValueChange={setName} placeholder="Proxy" />
        <FormTextField label="URL" value={endpoint} onValueChange={setEndpoint} placeholder="http://0.250.250.254:10809" />
        <Button variant="soft" onClick={addProxy}>Add</Button>
      </Grid>
      {proxies.length === 0 ? <Text size="2" color="gray">Direct is always available.</Text> : null}
    </Flex>
  );
}

function updateProxy(policy: IstioEgressPolicy, index: number, patch: Partial<EgressProxy>): IstioEgressPolicy {
  return {
    ...policy,
    proxies: (policy.proxies ?? []).map((proxy, i) => i === index ? { ...proxy, ...patch } : proxy)
  };
}

function removeProxy(policy: IstioEgressPolicy, proxyID: string): IstioEgressPolicy {
  return {
    ...policy,
    proxies: (policy.proxies ?? []).filter((proxy) => proxy.id !== proxyID),
    rules: policy.rules?.map((rule) => rule.proxyId === proxyID ? { ...rule, action: "direct", proxyId: "" } : rule),
    externalRuleSet: policy.externalRuleSet.proxyId === proxyID
      ? { ...policy.externalRuleSet, action: "direct", proxyId: "" }
      : policy.externalRuleSet
  };
}

function uniqueProxyID(proxies: EgressProxy[], name: string) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "proxy";
  const used = new Set(proxies.map((proxy) => proxy.id));
  if (!used.has(base)) {
    return base;
  }
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
}
