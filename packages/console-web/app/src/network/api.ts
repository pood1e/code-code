import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import {
  EgressProtocol,
  EgressResolution,
  EgressSyncPhase,
  type ExternalRule as ProtoExternalRule,
  type ServiceRule as ProtoServiceRule
} from "@code-code/agent-contract/egress/v1";
import {
  ListEgressPoliciesResponseSchema,
  type EgressPolicyView
} from "@code-code/agent-contract/platform/management/v1";
import { jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";
import useSWR from "swr";
import type {
  EgressPolicyCatalog,
  ExternalRule,
  IstioEgressPolicy,
  IstioEgressResourceRef,
  ServiceRule
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

function trimEgressPrefix(name: string) {
  const trimmed = name.replace(/^Egress\s+/i, "");
  return trimmed || name;
}

function toPolicyView(view: EgressPolicyView): IstioEgressPolicy {
  const policy = view.policy;
  const configuredByKind = sourceKind(view.configuredBy?.kind);
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
      crdKind: view.configuredBy?.crdKind ?? "ConfigMap"
    },
    accessSets: policy?.accessSets.map((accessSet) => ({
      id: accessSet.accessSetId,
      displayName: accessSet.displayName || accessSet.accessSetId,
      ownerService: accessSet.ownerService,
      policyId: accessSet.policyId,
      externalRules: accessSet.externalRules.map(toExternalRule),
      serviceRules: accessSet.serviceRules.map(toServiceRule)
    })) ?? [],
    consumers: view.consumers.map((consumer) => ({
      kind: "provider",
      id: consumer.id,
      displayName: consumer.displayName,
      crdKind: "Provider"
    }))
  };
}

function toExternalRule(rule: ProtoExternalRule): ExternalRule {
  const kind = rule.hostMatch?.kind;
  const wildcard = kind?.case === "hostWildcard";
  return {
    id: rule.externalRuleId,
    destinationId: rule.destinationId,
    name: rule.displayName || rule.destinationId,
    host: String(kind?.value ?? ""),
    hostKind: wildcard ? "wildcard" : "exact",
    port: rule.port,
    protocol: protocolName(rule.protocol),
    resolution: resolutionName(rule.resolution),
    addressCidr: rule.addressCidr
  };
}

function toServiceRule(rule: ProtoServiceRule): ServiceRule {
  return {
    id: rule.serviceRuleId,
    destinationId: rule.destinationId,
    sourceServiceAccounts: rule.sourceServiceAccounts
  };
}

function sourceKind(value: string | undefined) {
  if (value === "vendor" || value === "service") {
    return value;
  }
  return "cli";
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

function protocolName(value: EgressProtocol): ExternalRule["protocol"] {
  if (value === EgressProtocol.HTTP) {
    return "http";
  }
  if (value === EgressProtocol.TLS) {
    return "tls";
  }
  if (value === EgressProtocol.TCP) {
    return "tcp";
  }
  if (value === EgressProtocol.HTTPS) {
    return "https";
  }
  return "unspecified";
}

function resolutionName(value: EgressResolution): ExternalRule["resolution"] {
  if (value === EgressResolution.DNS) {
    return "dns";
  }
  if (value === EgressResolution.DYNAMIC_DNS) {
    return "dynamic-dns";
  }
  if (value === EgressResolution.NONE) {
    return "none";
  }
  return "unspecified";
}

function resourceRef(ref: { kind?: string; namespace?: string; name?: string } | undefined): IstioEgressResourceRef {
  return {
    kind: gatewayResourceKind(ref?.kind),
    namespace: ref?.namespace ?? "",
    name: ref?.name ?? ""
  };
}

function gatewayResourceKind(value: string | undefined): IstioEgressResourceRef["kind"] {
  if (
    value === "ServiceEntry" ||
    value === "AuthorizationPolicy" ||
    value === "HTTPRoute" ||
    value === "TLSRoute" ||
    value === "TCPRoute" ||
    value === "DestinationRule"
  ) {
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
