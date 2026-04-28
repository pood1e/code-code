# Kubernetes validation schemas

Local JSON schemas used by `make -C deploy validate` and `validate-all` when public kubeconform catalogs do not publish a schema for a CRD we render.

## Kiali

`kiali.io/kiali_v1alpha1.json` is generated from the official Kiali Operator CRD:

```bash
mkdir -p deploy/schemas/kiali.io
cd deploy/schemas/kiali.io
FILENAME_FORMAT='{kind}_{version}' \
  python3 "$(go env GOPATH)/pkg/mod/github.com/yannh/kubeconform@v0.7.0/scripts/openapi2jsonschema.py" \
  https://raw.githubusercontent.com/kiali/kiali-operator/master/crd-docs/crd/kiali.io_kialis.yaml
```
