package envoyauthprocessor

import (
	"net"
	"strings"

	corev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

type requestHeaders struct {
	values map[string][]string
}

func newRequestHeaders(headers []*corev3.HeaderValue) requestHeaders {
	values := make(map[string][]string, len(headers))
	for _, header := range headers {
		if header == nil {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(header.Key))
		if key == "" {
			continue
		}
		values[key] = append(values[key], headerValue(header))
	}
	return requestHeaders{values: values}
}

func headerValue(header *corev3.HeaderValue) string {
	if header == nil {
		return ""
	}
	if header.Value != "" {
		return header.Value
	}
	return string(header.RawValue)
}

func (headers requestHeaders) get(name string) string {
	values := headers.values[strings.ToLower(strings.TrimSpace(name))]
	for index := len(values) - 1; index >= 0; index-- {
		if value := strings.TrimSpace(values[index]); value != "" {
			return value
		}
	}
	return ""
}

func (headers requestHeaders) all(name string) []string {
	values := headers.values[strings.ToLower(strings.TrimSpace(name))]
	if len(values) == 0 {
		return nil
	}
	return append([]string(nil), values...)
}

func (headers requestHeaders) authority() string {
	if value := headers.get(":authority"); value != "" {
		return value
	}
	return headers.get("host")
}

func buildHeaderMutation(headers requestHeaders, auth *authContext) *extprocv3.HeaderMutation {
	mutation := &extprocv3.HeaderMutation{
		RemoveHeaders: append([]string(nil), internalHeaders...),
	}
	if auth == nil || !auth.matchesHost(headers.authority()) {
		return mutation
	}
	for _, name := range auth.RequestHeaderNames {
		current := headers.get(name)
		if current == "" {
			continue
		}
		next, ok := auth.replacementForHeader(headers, name, current)
		if !ok {
			continue
		}
		mutation.SetHeaders = append(mutation.SetHeaders, setHeader(name, next))
	}
	return mutation
}

func setHeader(name string, value string) *corev3.HeaderValueOption {
	return &corev3.HeaderValueOption{
		Header: &corev3.HeaderValue{
			Key:      strings.ToLower(strings.TrimSpace(name)),
			RawValue: []byte(value),
		},
		AppendAction: corev3.HeaderValueOption_OVERWRITE_IF_EXISTS_OR_ADD,
	}
}

func replacementValue(current string, prefix string, token string) (string, bool) {
	if token == "" {
		return "", false
	}
	current = strings.TrimSpace(current)
	if current == Placeholder {
		return token, true
	}
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return "", false
	}
	if current == prefix+" "+Placeholder {
		return prefix + " " + token, true
	}
	if strings.Contains(current, Placeholder) {
		return strings.ReplaceAll(current, Placeholder, token), true
	}
	return "", false
}

func (auth *authContext) matchesHost(authority string) bool {
	if auth == nil || !auth.hasReplacementMaterial() || len(auth.RequestHeaderNames) == 0 || !auth.matchesTargetHost(authority) {
		return false
	}
	return true
}

func (auth *authContext) matchesTargetHost(authority string) bool {
	if auth == nil || len(auth.TargetHosts) == 0 {
		return false
	}
	host := normalizeHost(authority)
	if host == "" {
		return false
	}
	for _, target := range auth.TargetHosts {
		if host == normalizeHost(target) {
			return true
		}
	}
	return false
}

func normalizeHost(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.TrimPrefix(value, "https://")
	value = strings.TrimPrefix(value, "http://")
	value = strings.TrimSuffix(value, ".")
	if host, _, err := net.SplitHostPort(value); err == nil {
		return strings.Trim(host, "[]")
	}
	if index := strings.LastIndex(value, ":"); index > 0 && !strings.Contains(value[:index], ":") {
		return value[:index]
	}
	return strings.Trim(value, "[]")
}

func splitList(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\t'
	})
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}
