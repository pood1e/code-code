# Model Catalog Page

## Responsibility

The Models page is an operator-facing catalog for canonical model definitions. It helps users scan available models, narrow them by vendor/source/availability, and inspect proxy providers for a selected canonical model.

The page owns presentation only. It uses the existing `ModelService.ListModelDefinitions` read model and must not define new model contracts or duplicate registry state.

## External Fields

- `ModelRegistryEntry.definition`: canonical identity, display name, capabilities, shape, modalities, and token limits.
- `ModelRegistryEntry.pricing`, `badges`, and `sources`: source-level price and availability signals shown on model cards.
- related `ModelRegistryEntry` entries with `source_ref`: proxy provider rows for the selected canonical model.
- `VendorView`: display name and icon for vendor identity.

## Interaction Model

The page uses a left facet rail and a right model list. Search, vendor, source, and availability filters update the existing list query and reset pagination.

Each model card is the primary action. Clicking it opens a proxy provider dialog for that canonical model. The dialog shows only proxy rows whose `source_ref` points at the canonical model; direct source metadata stays summarized on the card.

## Implementation Notes

- Keep filtering server-backed through the existing filter expression helpers.
- Do not add sort controls until the backend exposes a stable sort contract.
- Do not synthesize descriptions, usage counts, update timestamps, or facet counts; current contracts do not provide them.
- Keep the layout responsive: the facet rail stacks above the list on narrow screens, and cards keep visible focus states for keyboard users.
