# Provider Connect Mainline

## responsibility

- define one onboarding mainline for vendor API key, custom API key, and CLI OAuth provider connect
- keep `providerconnect.Service` as orchestration only
- move target planning, request building, idempotence, and connect-session state transition into local models

## key methods

- `providerconnect.Service.Connect(ctx, command)`
- `providerconnect.Service.GetSession(ctx, session_id)`
- `providerconnect.Service.Reauthorize(ctx, account)`

## implementation

- `platform-provider-service` maps `ConnectProviderRequest` to `providerconnect.ConnectCommand`
- `providerconnect.AddMethod` is the owner-local onboarding route enum; provider transport owns enum mapping
- `providerconnect.SessionPhase` is the owner-local connect-session phase enum; transport phase mapping stays at the boundary
- `providerconnect.ProviderSurfaceBindingPhase` is the owner-local provider endpoint phase enum for connect read models; transport phase mapping stays at the boundary
- `providerconnect.AccountView`, `ProviderSurfaceBindingView`, and `CredentialSubjectSummaryFieldView` are owner-local read models for reauthorize, session projection, and instance idempotence; provider transport maps views at the boundary
- `ConnectCommand` owns connect input normalize, add-method routing intent, and connect material validation
- `ConnectCommand.api_key.observability_token` carries one optional management-plane token override for vendor active query
- `ConnectResult` and `SessionView` are providerconnect-owned output models; provider transport maps them back to gRPC response/view
- `endpointCatalogSet` owns optional endpoint-model catalog override normalization and vendor endpoint matching
- `connectEndpointCandidate` owns custom/vendor/cli endpoint construction and target derivation
- `connectEndpointDefinition` owns provider-definition validation and endpoint credential/protocol compatibility
- `providerConnectQueries` owns provider endpoint lookup, account lookup, and definition load
- `providerConnectRuntime` owns internal runtime wiring behind `providerconnect.Service`
- `providerConnectResources`, `providerConnectPackages`, `providerConnectSessions`, and `providerConnectCatalogRuntime` own runtime dependency bundles for write, package lookup, session, and catalog/probe paths
- `vendorAPIKeyPackage` owns vendor API key display-name defaults and endpoint candidate derivation
- `cliOAuthPackage` owns CLI package flow, vendor, and display-name defaults for connect resolution
- `connectTarget` owns derived ids, OAuth session spec, credential request, and provider endpoint request
- `connectPlan` owns shared credential/account identity assignment for multi-endpoint vendor API key onboarding
- `providerConnectAPIKeyResolutionRuntime` and `apiKeyResolvedConnect` own custom/vendor API key target resolution, vendor package lookup, and connect execution selection
- `apiKeyConnectExecution` owns api-key credential write, instance batch write, rollback, and connected-instance result aggregation
- API-key connect is a saga, not a cross-store transaction: credential material is written before the provider aggregate, provider write failure deletes the just-created credential, and rollback failure is returned to the caller
- API-key connect may write one optional account-owned observability credential alongside the main data-plane credential when the user supplies a separate active-query token
- `cliOAuthCatalogPlan` owns CLI OAuth catalog fallback/probe planning and probe result resolution
- CLI OAuth probe catalog keeps unmatched probed ids by default; `antigravity` filters opaque raw ids before catalog projection, then enriches matching entries with fallback metadata
- `providerConnectCLIOAuthResolutionRuntime` owns CLI package lookup, connect/reauthorize target resolution, and CLI OAuth flow derivation
- `oauthSessionStartExecution` owns OAuth session start, session record persistence, cancel-on-store-failure, and initial session view projection
- `oauthFinalizePlan` owns imported credential resolution, finalize catalog injection, provider endpoint request, and existing-instance idempotence compare
- `providerConnectSessionSyncRuntime` and `providerConnectOAuthFinalizeRuntime` own OAuth state sync, finalize transition, CLI catalog resolution, and idempotent instance materialization
- `providerConnectSessionQueryRuntime` owns session record load, sync, persistence update, and final session view projection
- `sessionStore` owns connect-session ConfigMap persistence with `write client + APIReader`, so start/query follows read-after-write latest semantics
- `sessionTargetSnapshot` owns persisted target snapshot encode/decode for connect sessions
- `sessionProgress` owns OAuth phase projection and terminal transition
- `providerConnectSessionViewRuntime` owns provider lookup for session view assembly
- `sessionRecord` owns session persistence envelope and session view projection
- `postConnectBatch` owns connected instance normalization and observability probe target selection
- `providerConnectPostConnectWorkflow` submits durable Temporal post-connect workflows after provider endpoint persistence
- `TemporalPostConnectWorkflowRuntime` owns shared Temporal workflow submission for post-connect model discovery, catalog binding, and auth-service observability probe steps
- API-key connect persists endpoints before catalog discovery; endpoint model catalog may be empty until the post-connect Temporal workflow or operator edit fills it
- API-key connect returns the provider view from the provider write result so the console can display the saved provider immediately
- credential create writes Secret then CredentialDefinitionResource; if the second write fails, the created Secret is deleted before returning the error
- service only coordinates dependencies: credential write, provider endpoint write, session store, OAuth runtime, and post-connect dispatch
