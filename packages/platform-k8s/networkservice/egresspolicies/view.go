package egresspolicies

import (
	"strings"

	managementv1 "code-code.internal/go-contract/platform/management/v1"
)

func sourceView(kind string, id string, displayName string, crdKind string) *managementv1.EgressConfigSource {
	id = strings.TrimSpace(id)
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		displayName = id
	}
	return &managementv1.EgressConfigSource{
		Kind:        kind,
		Id:          id,
		DisplayName: displayName,
		CrdKind:     crdKind,
	}
}
