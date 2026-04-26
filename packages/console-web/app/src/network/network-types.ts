export type EgressAction = "direct" | "proxy";
export type ExternalRuleSetLoadPhase = "disabled" | "loaded" | "not-loaded" | "failed";

export type EgressRule = {
  id: string;
  name: string;
  match: string;
  matchKind: "hostExact" | "hostSuffix";
  action: EgressAction;
  proxyId: string;
};

export type ExternalRuleSet = {
  sourceUrl: string;
  enabled: boolean;
  action: EgressAction;
  proxyId: string;
};

export type ExternalRuleSetStatus = {
  phase: ExternalRuleSetLoadPhase;
  sourceUrl: string;
  loadedHostCount: number;
  skippedRuleCount: number;
  message: string;
  loadedAt?: string;
};

export type EgressProxy = {
  id: string;
  name: string;
  endpoint: string;
  protocol: "http";
};

export type EgressConfigSourceKind = "cli" | "vendor" | "service";

export type EgressConfigSource = {
  kind: EgressConfigSourceKind;
  id: string;
  displayName: string;
  crdKind: string;
};

export type EgressConsumerKind = "provider";

export type EgressConsumer = {
  kind: EgressConsumerKind;
  id: string;
  displayName: string;
  crdKind: "Provider";
};

export type IstioEgressResourceRef = {
  kind: "Gateway" | "ServiceEntry" | "VirtualService" | "DestinationRule";
  namespace: string;
  name: string;
};

export type IstioEgressSync = {
  status: "synced" | "pending" | "failed";
  reason: string;
  observedGeneration: number;
  targetGateway: IstioEgressResourceRef;
  appliedResources: IstioEgressResourceRef[];
  lastSyncedAt?: string;
};

export type HeaderModification = {
  scope: string;
  header: string;
  action: "set" | "add" | "remove";
  valueSource: string;
};

export type HeaderMetricRule = {
  profile: string;
  header: string;
  metric: string;
  valueType: string;
  labels?: string[];
};

export type IstioEgressPolicy = {
  id: string;
  displayName: string;
  owner: "istio";
  sync: IstioEgressSync;
  configuredBy: EgressConfigSource;
  proxies?: EgressProxy[];
  rules?: EgressRule[];
  externalRuleSet: ExternalRuleSet;
  externalRuleSetStatus: ExternalRuleSetStatus;
  headerModifications?: HeaderModification[];
  headerMetrics?: HeaderMetricRule[];
  consumers: EgressConsumer[];
};

export type EgressPolicyCatalog = {
  policies: IstioEgressPolicy[];
};

export type EgressDecision = {
  action: EgressAction;
  reason: string;
  matchedRule?: string;
  upstream?: string;
};
