## Resource Reference Labels

### Responsibility

Reference ownership for management-plane delete protection is encoded on the
referencing Kubernetes resources themselves.

### Owner

`packages/platform-k8s` owns the label schema and keeps it synchronized when
writing management resources.

### Labels

- `platform.code-code.internal/provider-credential-ref`
  Stores the referenced provider credential identifier.
### Writers

- `ProviderSurfaceBinding` writers record provider credential reference labels.

### Readers

`references.ResourceReferenceChecker` resolves references only through
namespace-scoped Kubernetes label selectors.

### Failure Behavior

- Missing labels on newly written resources are invalid.
- Delete checks treat selector matches as authoritative references.
- Resources that do not support a given reference omit the corresponding label.
