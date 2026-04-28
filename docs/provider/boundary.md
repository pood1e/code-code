# LLM Provider Boundary

## responsibility

- `ProviderSurface` owns stable access capability.
- `ProviderAccount` owns tenant configuration.
- Access target owns callable path shape under an account.
- `CredentialGrant` owns auth identity and secret material lifecycle.
- `ModelDefinition` owns canonical model facts.

## ownership

- provider account owns provider-side routing facts
- model registry owns authority model truth
- auth service owns credential material truth
- egress policy owner owns outbound network policy
- agent runtime owns execution image and runtime lifecycle

## rules

- submitted runs freeze provider account, access target, credential generation,
  provider-native model id, and canonical model ref into `ProviderRunBinding`
- provider accounts do not own default models
- `model_ref` only expresses authority binding when present
- provider read paths do not read credential material except fields explicitly declared by support-owned observability policy
- endpoint-shaped projections are internal compatibility details only
