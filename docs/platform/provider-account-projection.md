# Provider Account Projection

## responsibility

- own `ProviderView` projection from `ProviderSurfaceBindingView[]`
- keep provider as management read model, not platform resource
- keep account-level mutation preconditions explicit
- project CLI OAuth account summary from `CLISpecializationPackage.oauth.account_summary_fields`
- own optional account-level observability credential binding for API-key vendors

## key methods

- `providers.Service.List(ctx)`
- `providers.Service.Get(ctx, account_id)`
- `providers.Service.Update(ctx, account_id, command)`
- `providers.Service.UpdateAPIKeyAuthentication(ctx, account_id, command)`
- `providers.Service.UpdateObservabilityAuthentication(ctx, account_id, command)`
- `providers.Service.Delete(ctx, account_id)`

## implementation

- `Account` aggregate owns grouping, projection, mutation precondition checks, and credential command building
- `UpdateAccountCommand`, `UpdateAPIKeyAuthenticationCommand`, and `UpdateObservabilityAuthenticationCommand` are the only account-owner write inputs from transport
- `UpdateAPIKeyAuthenticationCommand` owns only the shared data-plane credential update
- `UpdateObservabilityAuthenticationCommand` only exists for vendors with explicit management-plane auth schema; there is no generic session/token fallback
- management-plane auth forms are declared by `observability.v1.ActiveQueryInputForm` in support YAML; console renders that proto schema and does not hard-code vendor/session fields
- providerservice resolves the support-owned input form, rejects undeclared submitted fields, applies declared transient transforms, and derives required keys before calling authservice
- `providerProjectionRuntime` owns account list/get projection and read-side enrichment orchestration
- `providerIconRuntime` owns vendor/CLI icon lookup and icon projection
- `providerOAuthSummaryRuntime` owns CLI OAuth summary resolution from CLI package and credential data
- `providerMutationRuntime` owns account rename, delete, api-key auth update, and independent observability credential update orchestration
- provider card projection stays vendor-specific: compact card summaries must read raw quota metrics and keep percent as display aid only
- quota card presentation reuses one shared number formatter and one shared title suffix path; vendor cards only project vendor-owned rows and selectors
- Cerebras quota card groups rows by `model_id` first, then expands `tokens -> requests` inside one model group, with secondary rows rendered as compact children
- Gemini quota card only renders quota groups whose live probe response carries a real window; zero-filled unsupported groups stay hidden
- Gemini quota card normalizes long subscription marketing names into short tier badges such as `Free`, `Pro`, and `Ultra`
- Codex quota card surfaces plan-only models such as `gpt-5.3-codex-spark` from the probed endpoint catalog instead of hard-coding them
- MiniMax quota card maps internal quota buckets such as `coding-plan-search` into stable user-facing labels and orders product models ahead of internal plan rows
- Antigravity quota card folds runtime models into curated family groups; `Claude` and `OpenAI` share one quota group, and the visible reset cadence is annotated directly in the row label
- active-query provider cards render probe status directly in the quota header; non-active-query quota cards still render moving relative updated time
- quota header keeps one compact line: `Quota` on the left, probe status and tier/vendor tags packed at the right edge
- quota header status uses the same account status badge semantics as the main card, and quota child rows compress vertical spacing instead of repeating full group gaps
- vendor-specific selectors such as Cerebras org choice render below the quota header instead of competing with header status and title suffix
- active-query account status is projected from probe gauges only: `last_outcome + last_run`
- `ProviderView` is projected by grouping instances on `provider_id`
- `ProviderView.credential_subject_summary` is display-ready summary, not raw credential data
- API-key accounts default vendor observability to the shared data-plane API key
- when one vendor needs separate management-plane auth, account owner stores one derived optional observability credential and vendor observability runtime prefers it over the data-plane API key
- read projection is best-effort and must not fail only because sibling endpoints drift on shared fields
- endpoints missing `provider_id` are skipped from read projection
- CLI OAuth summary fields are resolved from credential OAuth artifact through CLI-owned field declarations
- account-level mutations require one consistent account shape before they write: shared `provider_display_name`, `vendor_id`, `provider_credential_id`, endpoint auth kind, and CLI `cli_id` when auth kind is CLI
- account display name rewrite is executed through `providersurfacebindings` owner path
- CLI OAuth reauthorization is orchestrated at `platform-provider-service -> providerconnect`, not inside account owner
