# Registered Catalogs

## responsibility

- keep static vendor and CLI capability catalogs inside service-owned registries
- expose catalog views through provider service APIs
- keep mutable provider account state in Postgres

## external fields

- vendor catalog: `vendors/identity`
- vendor capabilities: `vendors/capabilitypackages`
- CLI definitions: `clidefinitions/identity`
- CLI specializations: `clidefinitions/specializations`

## implementation

- Kubernetes no longer installs catalog CRs for vendor or CLI definitions.
- provider service assembles catalog views from registered packages.
- provider accounts stay in `platform_providers`.
