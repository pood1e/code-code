package models

import (
	modelv1 "code-code.internal/go-contract/model/v1"
)

type collectedDefinitionsSnapshot struct {
	vendorScope         configuredVendorScope
	configuredVendorIDs map[string]struct{}
	managedVendorIDs    map[string]struct{}
	collectedVendorIDs  map[string]struct{}
	definitions         map[string]collectedDefinition
}

type collectedDefinition struct {
	definition *modelv1.ModelDefinition
	sourceRef  *modelv1.ModelRef
	badges     []string
	pricing    *definitionSourcePricing
	sources    []definitionSource
}

func cloneStringSet(values map[string]struct{}) map[string]struct{} {
	if len(values) == 0 {
		return map[string]struct{}{}
	}
	out := make(map[string]struct{}, len(values))
	for key := range values {
		out[key] = struct{}{}
	}
	return out
}

func cloneStringMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string, len(values))
	for key, value := range values {
		out[key] = value
	}
	return out
}

func cloneStringSliceMap(values map[string][]string) map[string][]string {
	if len(values) == 0 {
		return map[string][]string{}
	}
	out := make(map[string][]string, len(values))
	for key, items := range values {
		out[key] = append([]string(nil), items...)
	}
	return out
}
