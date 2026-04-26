# Model Catalog Sources

## responsibility

`ModelCatalogSource` is the model-side catalog capability registry. One
implementation is identified by `type + id`:

- `VENDOR + vendor_id`
- `CLI + cli_id`

The implementation owns how models are obtained. It may use static
package data, YAML-backed data, HTTP APIs, SDKs, CLI runtimes, OAuth sessions,
or a mix of them.

## contract

`platform-model-service` owns the registry and calls registered sources. Each
source returns catalog rows:

- `source_model_id`: source-local or provider-callable model id
- `definition`: unified `model.v1.ModelDefinition`

Rules:

- A registered vendor source id must match a vendor package `vendor_id`.
- A registered CLI source id must match a CLI specialization `cli_id`.
- Duplicate source registration is invalid.
- Catalog row output must include a definition with stable `vendor_id + model_id`.
- `source_model_id` may differ from `definition.model_id` for proxy or aggregator providers.
- Provider-specific catalog storage is outside the model-service contract.
- Caller-supplied target context is limited to `target_id` and `auth_ref`.
- Protocol, base URL, and request shape are resolved by the registered implementation from vendor or CLI package data.

## implementation notes

`provider-service`, model definition sync, and CLI account flows decide when to
call a source and how to use the returned catalog rows. Model service does not
persist provider catalogs, convert provider entries, or encode result purpose.

Registered sources dispatch through vendor or CLI packages. Shared implementation
details such as `/v1/models` parsing or static model conversion stay inside
`modelcatalogsources/vendors` or `modelcatalogsources/clis`.
