import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  EgressAction,
  EgressExternalRuleSetLoadPhase,
  type EgressProxy,
  EgressProxyProtocol,
  type EgressRule,
  EgressSyncPhase
} from "@code-code/agent-contract/egress/v1";
import {
  ListEgressPoliciesResponseSchema,
  UpdateEgressPolicyResponseSchema,
  type EgressPolicyView
} from "@code-code/agent-contract/platform/management/v1";
import { jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";
import useSWR from "swr";
import type {
  EgressPolicyCatalog,
  IstioEgressPolicy,
  IstioEgressResourceRef,
  EgressRule as UIEgressRule,
  EgressAction as UIEgressAction,
  ExternalRuleSetLoadPhase as UIExternalRuleSetLoadPhase,
  HeaderMetricRule,
  HeaderModification
} from "./network-types";

const egressPoliciesPath = "/api/network/egress-policies";

export function useEgressPolicyCatalog() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(
    egressPoliciesPath,
    jsonFetcher<JsonValue>
  );
  const response = data ? fromJson(ListEgressPoliciesResponseSchema, data, protobufJsonReadOptions) : undefined;

  return {
    catalog: { policies: (response?.items ?? []).map(toPolicyView) } satisfies EgressPolicyCatalog,
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}

export async function saveEgressPolicy(policy: IstioEgressPolicy): Promise<IstioEgressPolicy> {
  const response = await fetch(`${egressPoliciesPath}/${encodeURIComponent(policy.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ policy: toPolicyUpdate(policy) })
  });
  const payload = await response.text();
  if (!response.ok) {
    throw new Error(parseServiceError(payload, response.status));
  }
  if (!payload.trim()) {
    return policy;
  }
  const updateResponse = fromJson(UpdateEgressPolicyResponseSchema, JSON.parse(payload) as JsonValue, protobufJsonReadOptions);
  if (!updateResponse.item) {
    return policy;
  }
  return toPolicyView(updateResponse.item);
}

function trimEgressPrefix(name: string) {
  const trimmed = name.replace(/^Egress\s+/i, "");
  return trimmed || name;
}

function toPolicyView(view: EgressPolicyView): IstioEgressPolicy {
  const policy = view.policy;
  const configuredByKind = sourceKind(view.configuredBy?.kind);
  const headerModifications: HeaderModification[] = view.headerModifications.map((item) => ({
    scope: item.scope,
    header: item.header,
    action: item.action === "add" || item.action === "remove" ? item.action : "set",
    valueSource: item.valueSource
  }));
  const headerMetrics: HeaderMetricRule[] = view.headerMetrics.map((item) => ({
    profile: item.profile,
    header: item.header,
    metric: item.metric,
    valueType: item.valueType,
    labels: item.labels
  }));
  return {
    id: policy?.policyId ?? "",
    displayName: trimEgressPrefix(policy?.displayName ?? ""),
    owner: "istio",
    sync: {
      status: syncStatus(view.sync?.phase),
      reason: view.sync?.reason ?? "",
      observedGeneration: Number(view.sync?.observedGeneration ?? 0n),
      targetGateway: resourceRef(view.sync?.targetGateway),
      appliedResources: view.sync?.appliedResources.map(resourceRef) ?? [],
      lastSyncedAt: timestampText(view.sync?.lastSyncedAt)
    },
    configuredBy: {
      kind: configuredByKind,
      id: view.configuredBy?.id ?? "",
      displayName: view.configuredBy?.displayName ?? "",
      crdKind: view.configuredBy?.crdKind ?? "Gateway"
    },
    proxies: policy?.proxies.map((proxy: EgressProxy) => ({
      id: proxy.proxyId,
      name: proxy.displayName || proxy.proxyId,
      endpoint: proxy.url,
      protocol: proxy.protocol === EgressProxyProtocol.HTTP ? "http" : "http"
    })),
    rules: policy?.customRules.map((rule: EgressRule) => {
      const match = ruleMatch(rule);
      return {
        id: rule.ruleId,
        name: rule.displayName,
        match: match.value,
        matchKind: match.kind,
        action: action(rule.action),
        proxyId: rule.proxyId
      };
    }),
    externalRuleSet: {
      sourceUrl: policy?.externalRuleSet?.sourceUrl ?? "",
      enabled: policy?.externalRuleSet?.enabled ?? false,
      action: action(policy?.externalRuleSet?.action),
      proxyId: policy?.externalRuleSet?.proxyId ?? ""
    },
    externalRuleSetStatus: {
      phase: externalRuleSetLoadPhase(view.externalRuleSetStatus?.phase),
      sourceUrl: view.externalRuleSetStatus?.sourceUrl ?? policy?.externalRuleSet?.sourceUrl ?? "",
      loadedHostCount: view.externalRuleSetStatus?.loadedHostCount ?? 0,
      skippedRuleCount: view.externalRuleSetStatus?.skippedRuleCount ?? 0,
      message: view.externalRuleSetStatus?.message ?? "",
      loadedAt: timestampText(view.externalRuleSetStatus?.loadedAt)
    },
    headerModifications,
    headerMetrics,
    consumers: view.consumers.map((consumer) => ({
      kind: "provider",
      id: consumer.id,
      displayName: consumer.displayName,
      crdKind: "Provider"
    }))
  };
}

function ruleMatch(rule: EgressRule): { kind: "hostExact" | "hostSuffix"; value: string } {
  const kind = rule.match?.kind;
  if (kind?.case === "hostSuffix") {
    const suffix = normalizeSuffixHost(String(kind.value ?? ""));
    return { kind: "hostSuffix", value: suffix ? `*.${suffix}` : "" };
  }
  return { kind: "hostExact", value: String(kind?.case === "hostExact" ? kind.value ?? "" : "") };
}

function toPolicyUpdate(policy: IstioEgressPolicy) {
  return {
    policyId: policy.id,
    displayName: policy.displayName,
    proxies: (policy.proxies ?? []).map((proxy) => ({
      proxyId: proxy.id,
      displayName: proxy.name,
      protocol: "EGRESS_PROXY_PROTOCOL_HTTP",
      url: proxy.endpoint
    })),
    customRules: (policy.rules ?? []).map((rule) => ({
      ruleId: rule.id,
      displayName: rule.name,
      match: toRuleMatch(rule),
      action: toProtoAction(rule.action),
      proxyId: rule.action === "proxy" ? rule.proxyId : ""
    })),
    externalRuleSet: {
      sourceUrl: policy.externalRuleSet.sourceUrl,
      enabled: policy.externalRuleSet.enabled,
      action: toProtoAction(policy.externalRuleSet.action),
      proxyId: policy.externalRuleSet.action === "proxy" ? policy.externalRuleSet.proxyId : ""
    }
  };
}

function toRuleMatch(rule: UIEgressRule) {
  if (rule.matchKind === "hostSuffix") {
    return { hostSuffix: normalizeSuffixHost(rule.match) };
  }
  return { hostExact: normalizeExactHost(rule.match) };
}

function normalizeExactHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function normalizeSuffixHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "").replace(/^\*\./, "").replace(/^\./, "");
}

function toProtoAction(value: UIEgressAction) {
  if (value === "proxy") {
    return "EGRESS_ACTION_PROXY";
  }
  return "EGRESS_ACTION_DIRECT";
}

function sourceKind(value: string | undefined) {
  if (value === "vendor" || value === "service") {
    return value;
  }
  return "cli";
}

function action(value: EgressAction | undefined): UIEgressAction {
  if (value === EgressAction.PROXY) {
    return "proxy";
  }
  return "direct";
}

function externalRuleSetLoadPhase(value: EgressExternalRuleSetLoadPhase | undefined): UIExternalRuleSetLoadPhase {
  if (value === EgressExternalRuleSetLoadPhase.LOADED) {
    return "loaded";
  }
  if (value === EgressExternalRuleSetLoadPhase.FAILED) {
    return "failed";
  }
  if (value === EgressExternalRuleSetLoadPhase.NOT_LOADED) {
    return "not-loaded";
  }
  return "disabled";
}

function syncStatus(value: EgressSyncPhase | undefined) {
  if (value === EgressSyncPhase.SYNCED) {
    return "synced";
  }
  if (value === EgressSyncPhase.FAILED) {
    return "failed";
  }
  return "pending";
}

function resourceRef(ref: { kind?: string; namespace?: string; name?: string } | undefined): IstioEgressResourceRef {
  const kind = gatewayResourceKind(ref?.kind);
  return {
    kind,
    namespace: ref?.namespace ?? "",
    name: ref?.name ?? ""
  };
}

function gatewayResourceKind(value: string | undefined): IstioEgressResourceRef["kind"] {
  if (value === "ServiceEntry" || value === "VirtualService" || value === "DestinationRule") {
    return value;
  }
  return "Gateway";
}

function timestampText(timestamp: { seconds?: bigint; nanos?: number } | undefined) {
  if (!timestamp?.seconds) {
    return undefined;
  }
  return new Date(Number(timestamp.seconds) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000)).toISOString();
}

function parseServiceError(payload: string, status: number) {
  try {
    const parsed = JSON.parse(payload) as { message?: string };
    if (parsed?.message && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // ignore JSON parse errors and fall back to raw payload/status text
  }
  const message = payload.trim();
  if (message) {
    return message;
  }
  return `request failed (${status})`;
}
