# Provider Connect Catalog Binding

## responsibility

`platform-provider-service` binds discovered provider catalogs to registry model definitions after provider connect or scheduled catalog work.

## implementation notes

Model registry rows are read through `platform-model-service`; provider service persists the resulting binding onto the provider aggregate.
