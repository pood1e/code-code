package egresspolicies

import (
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func interestingConditions(resource *unstructured.Unstructured) []map[string]any {
	conditions := resourceConditions(resource)
	out := make([]map[string]any, 0, len(conditions))
	for _, condition := range conditions {
		if isExpectedCondition(resource, conditionString(condition, "type")) {
			out = append(out, condition)
		}
	}
	return out
}

func resourceConditions(resource *unstructured.Unstructured) []map[string]any {
	switch resource.GroupVersionKind() {
	default:
		items, _, _ := unstructured.NestedSlice(resource.Object, "status", "conditions")
		return conditionMaps(items)
	}
}

func nestedConditionMaps(resource *unstructured.Unstructured, fields ...string) []map[string]any {
	parents, _, _ := unstructured.NestedSlice(resource.Object, fields...)
	out := []map[string]any{}
	for _, parent := range parents {
		value, ok := parent.(map[string]any)
		if !ok {
			continue
		}
		conditions, _ := value["conditions"].([]any)
		out = append(out, conditionMaps(conditions)...)
	}
	return out
}

func conditionMaps(items []any) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		condition, ok := item.(map[string]any)
		if ok {
			out = append(out, condition)
		}
	}
	return out
}

func expectedConditions(_ *unstructured.Unstructured) []string {
	return nil
}

func isExpectedCondition(resource *unstructured.Unstructured, conditionType string) bool {
	for _, expected := range expectedConditions(resource) {
		if conditionType == expected {
			return true
		}
	}
	return false
}

func conditionString(condition map[string]any, key string) string {
	value, _ := condition[key].(string)
	return strings.TrimSpace(value)
}
