package parser

import (
	"encoding/json"
	"fmt"
	"strings"
)

func DecodeJSONLine(line []byte, target any) bool {
	trimmed := strings.TrimSpace(string(line))
	if trimmed == "" {
		return false
	}
	return json.Unmarshal([]byte(trimmed), target) == nil
}

func MapValue(payload map[string]any, key string) map[string]any {
	value, _ := payload[key].(map[string]any)
	return value
}

func SliceValue(payload map[string]any, key string) []any {
	value, _ := payload[key].([]any)
	return value
}

func StringValue(payload map[string]any, key string) string {
	value, _ := payload[key].(string)
	return value
}

func BoolValue(payload map[string]any, key string) bool {
	value, _ := payload[key].(bool)
	return value
}

func Int64Value(value any) int64 {
	switch typed := value.(type) {
	case int:
		return int64(typed)
	case int32:
		return int64(typed)
	case int64:
		return typed
	case float64:
		return int64(typed)
	default:
		return 0
	}
}

func Summary(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(typed)
	default:
		body, err := json.Marshal(typed)
		if err != nil {
			return fmt.Sprint(typed)
		}
		return strings.TrimSpace(string(body))
	}
}

func TurnUsage(inputTokens, outputTokens, cachedInputTokens, reasoningOutputTokens, requestCount, toolCallCount int64) UsagePayload {
	if inputTokens == 0 && outputTokens == 0 && cachedInputTokens == 0 && reasoningOutputTokens == 0 && requestCount == 0 && toolCallCount == 0 {
		return nil
	}
	return UsagePayload{
		"usage": map[string]any{
			"inputTokens":           inputTokens,
			"outputTokens":          outputTokens,
			"cachedInputTokens":     cachedInputTokens,
			"reasoningOutputTokens": reasoningOutputTokens,
		},
		"counters": map[string]any{
			"requestCount":  requestCount,
			"toolCallCount": toolCallCount,
		},
	}
}
