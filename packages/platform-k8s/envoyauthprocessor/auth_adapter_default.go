package envoyauthprocessor

import (
	"strings"

	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

type defaultAuthAdapter struct{}

func (defaultAuthAdapter) ID() string {
	return defaultAuthAdapterID
}

func (defaultAuthAdapter) HasMaterial(material map[string]string) bool {
	return firstNonEmptyMaterial(material) != ""
}

func (defaultAuthAdapter) SerializesCookie() bool {
	return false
}

func (defaultAuthAdapter) Replacement(auth *authContext, _ requestHeaders, name string, current string) (string, bool) {
	auth.mu.Lock()
	defer auth.mu.Unlock()
	token := defaultHeaderMaterial(auth.Material, name)
	return replacementValue(current, auth.HeaderValuePrefix, token)
}

func (defaultAuthAdapter) ResponseMutation(*authContext, requestHeaders) (*extprocv3.HeaderMutation, bool) {
	return nil, false
}

func defaultHeaderMaterial(material map[string]string, headerName string) string {
	headerName = normalizeMaterialKey(headerName)
	if value := materialByKey(material, headerName); value != "" {
		return value
	}
	switch headerName {
	case "authorization":
		return firstMaterial(material, "access_token", "api_key", "token")
	case "x_api_key", "x_goog_api_key":
		return firstMaterial(material, headerName, "api_key")
	default:
		return firstNonEmptyMaterial(material)
	}
}

func firstNonEmptyMaterial(material map[string]string) string {
	for _, value := range material {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

func firstMaterial(material map[string]string, keys ...string) string {
	for _, key := range keys {
		if value := materialByKey(material, key); value != "" {
			return value
		}
	}
	return ""
}

func materialByKey(material map[string]string, key string) string {
	key = normalizeMaterialKey(key)
	for currentKey, value := range material {
		if normalizeMaterialKey(currentKey) == key {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func setMaterial(material map[string]string, key string, value string) {
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if key == "" {
		return
	}
	if value == "" {
		delete(material, key)
		return
	}
	material[key] = value
}

func normalizeMaterialKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	replacer := strings.NewReplacer("-", "_", ".", "_")
	return replacer.Replace(value)
}
