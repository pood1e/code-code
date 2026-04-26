# Connect RPC

## responsibility

`console-api` exposes browser-facing Connect RPC under `/api/connect`.

`platform-*` services own the generated Connect handlers for their own protobuf services.

## external methods

`/api/connect/platform.model.v1.ModelService/ListModelDefinitions` forwards to `platform-model-service` HTTP port.

`/api/connect/platform.provider.v1.ProviderService/ListVendors` forwards to `platform-provider-service` HTTP port.

## implementation notes

Connect uses generated protobuf service descriptors and binary protobuf payloads.

`console-api` keeps `/api/*` for BFF endpoints and proxies `/api/connect/*` only for allowlisted platform services.

`platform-model-service` mounts only allowlisted Connect procedure paths on its existing HTTP listener beside internal trigger routes.
