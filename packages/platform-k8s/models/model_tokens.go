package models

import "strings"

func hasModelToken(value string, tokens ...string) bool {
	if len(tokens) == 0 {
		return false
	}
	known := map[string]struct{}{}
	for _, token := range tokens {
		token = strings.TrimSpace(strings.ToLower(token))
		if token != "" {
			known[token] = struct{}{}
		}
	}
	for _, token := range strings.FieldsFunc(strings.ToLower(strings.TrimSpace(value)), splitOpenRouterModelToken) {
		if _, ok := known[token]; ok {
			return true
		}
	}
	return false
}
