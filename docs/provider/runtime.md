# LLM Provider Runtime

## responsibility

Provider runtime code turns one resolved access binding into callable provider
behavior.

Runtime code owns provider health checks, provider-native model catalog probes,
protocol-specific request execution, and cleanup. It does not own provider
account defaults, canonical model truth, or credential storage.

## input

The runtime boundary should consume frozen execution data:

- provider id
- access target id
- access shape: CLI/API/Web
- runtime URL or resource URL
- provider-native model id
- resolved credential material

Endpoint-shaped inputs are compatibility projections and should not leak to new
public contracts.

## discovery

Model discovery is explicit and stateless from the runtime perspective. It can
return provider-native model ids and optional model refs, but it does not write
provider status or canonical model registry truth directly.
