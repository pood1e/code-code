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

export type ExternalRule = {
  id: string;
  destinationId: string;
  name: string;
  host: string;
  hostKind: "exact" | "wildcard";
  port: number;
  protocol: "http" | "https" | "tls" | "tcp" | "unspecified";
  resolution: "dns" | "dynamic-dns" | "none" | "unspecified";
  addressCidr: string;
};

export type ServiceRule = {
  id: string;
  destinationId: string;
  sourceServiceAccounts: string[];
};

export type ExternalAccessSet = {
  id: string;
  displayName: string;
  ownerService: string;
  policyId: string;
  externalRules: ExternalRule[];
  serviceRules: ServiceRule[];
};

export type IstioEgressResourceRef = {
  kind: "Gateway" | "ServiceEntry" | "AuthorizationPolicy" | "HTTPRoute" | "TLSRoute" | "TCPRoute" | "DestinationRule";
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

export type IstioEgressPolicy = {
  id: string;
  displayName: string;
  owner: "istio";
  sync: IstioEgressSync;
  configuredBy: EgressConfigSource;
  accessSets: ExternalAccessSet[];
  consumers: EgressConsumer[];
};

export type EgressPolicyCatalog = {
  policies: IstioEgressPolicy[];
};
