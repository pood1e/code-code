# Model Contract

## Responsibility

`model` owns canonical model truth:

- stable canonical identity (vendor_id + model_id)
- canonical metadata (family, version, lifecycle, context spec, capabilities)
- canonical ref lookup and alias resolution
- provider override merge

It does NOT own:

- provider availability
- endpoint-local model id
- provider latency, quota, region
- registry page source projection
- pricing or offering (Phase 2 — separate `model_offering` domain)

## ModelRef

- `vendor_id + model_id`
  - canonical model stable identity

Rules:

- `ModelRef` must always be a complete canonical ref when it appears
- provider/catalog may consume a bound `ModelRef`
- provider/catalog does not infer, split, or complete `ModelRef`

## ModelVersion

Replaces the former `ModelDefinition`.

Core fields:

- `model_id` — unique within vendor scope
- `vendor_id` — canonical vendor identity
- `display_name`
- `aliases`
- `capabilities` — `TOOL_CALLING`, `STRUCTURED_OUTPUT`, `IMAGE_INPUT`, `STREAMING`, `REASONING`, `BATCH`, `FINE_TUNE`, `EMBEDDING`, `RERANK`, `JSON_MODE`, `JSON_SCHEMA`, `AUDIO_INPUT`, `AUDIO_OUTPUT`, `VIDEO_INPUT`
- `primary_shape` / `supported_shapes`
- `input_modalities` / `output_modalities`

New fields:

- `family_slug` — model family without version suffix (e.g. `claude-sonnet`)
- `version` — explicit version string from model owner
- `canonical_model_id` — fully qualified `{vendor_id}/{family_slug}@{version}`
- `lifecycle_status` — `ACTIVE`, `LEGACY`, `DEPRECATED`, `EOL`, `BLOCKED`
- `context_spec` — structured token limits and tokenizer info
- `category` — `CHAT`, `EMBEDDING`, `RERANK`, `IMAGE_GEN`, `AUDIO`, `VIDEO`, `MODERATION`
- `release_date`, `training_cutoff`, `license_type`, `is_open_weights`, `description`

Rules:

- `ModelVersion` expresses canonical model metadata
- `vendor_id + model_id` is the unique business truth
- `primary_shape` / `supported_shapes` express platform runtime compatibility
- `context_spec` replaces the former flat `context_window_tokens` / `max_output_tokens`

## ContextSpec

- `max_input_tokens`
- `max_output_tokens`
- `max_context_tokens` — total context window (input + output)
- `max_reasoning_tokens`
- `tokenizer` — identifier (e.g. `cl100k_base`, `o200k_base`)
- `tokenizer_source` — origin (e.g. `openai`, `sentencepiece`)

## ModelOverride

`ModelOverride` expresses provider overrides for canonical model metadata.

Allowed fields:

- `display_name`
- `context_spec`
- `capabilities`
- `primary_shape`
- `supported_shapes`
- `input_modalities`
- `output_modalities`

## ResolvedModel

- `model_id` — canonical model id
- `effective_definition` — effective canonical `ModelVersion` after applying override

## ModelCard

Structured documentation for a model. Contains:

- `schema_version`
- `metadata_json` — structured capabilities, safety, modality metadata
- `markdown_body` — standardized documentation sections
- `source_type` / `source_url`
- `review_status` / `reviewer`

## ModelRegistry

Responsibilities:

- `GetModelVersion(ref)` — read canonical `ModelVersion` by `ModelRef`
- `ListModels()` — list visible canonical models
- `ResolveModelRef(modelIDOrAlias)` — return canonical `ModelRef`
- `GetModelCard(ref)` — read model card
- `Resolve(ref, override)` — synthesize `ResolvedModel`

Rules:

- registry exposes only canonical capabilities externally
- vendor-scoped binding is internal implementation, not shared consumer contract
