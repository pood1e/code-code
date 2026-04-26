## responsibility

Own CLI-specific OAuth strategies behind internal registries so callers only depend on generic runner and registry entry points.

## key methods

`authservice/credentials.NewRefreshRunner`
uses registered OAuth refreshers when config does not inject overrides.

`providerobservability.NewOAuthObservabilityRunner`
uses registered OAuth observability collectors when config does not inject overrides.

`oauth.RegisteredCodeFlowAuthorizers`
builds all registered code-flow authorizers for session runtime assembly.

`authservice/credentials.applySpecializedOAuthSecretData`
dispatches to registered CLI secret-data appliers.

`authservice/credentials.resolveCLIOAuthProbeBaseURLs`
dispatches to registered CLI probe base-url resolvers.

## implementation notes

Each CLI registers its own strategy from its dedicated file.

Assembly and runtime code must not branch on concrete `cliId` values.
