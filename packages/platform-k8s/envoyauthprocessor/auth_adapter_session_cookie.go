package envoyauthprocessor

import (
	"net/http"
	"sort"
	"strings"

	"code-code.internal/platform-k8s/egressauth"
	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

const sessionCookieAuthAdapterID = egressauth.AuthAdapterSessionCookieID

type sessionCookieAuthAdapter struct{}

func (sessionCookieAuthAdapter) ID() string {
	return sessionCookieAuthAdapterID
}

func (sessionCookieAuthAdapter) HasMaterial(material map[string]string) bool {
	return cookieMaterialPresent(material) || defaultAuthAdapter{}.HasMaterial(material)
}

func (sessionCookieAuthAdapter) SerializesCookie() bool {
	return true
}

func (adapter sessionCookieAuthAdapter) Replacement(auth *authContext, _ requestHeaders, name string, current string) (string, bool) {
	if strings.ToLower(strings.TrimSpace(name)) != "cookie" {
		return defaultAuthAdapter{}.Replacement(auth, requestHeaders{}, name, current)
	}
	auth.mu.Lock()
	defer auth.mu.Unlock()
	return adapter.cookieReplacementLocked(auth, current)
}

func (adapter sessionCookieAuthAdapter) ResponseMutation(auth *authContext, headers requestHeaders) (*extprocv3.HeaderMutation, bool) {
	setCookies := headers.all("set-cookie")
	if len(setCookies) == 0 {
		return nil, false
	}
	auth.mu.Lock()
	defer auth.mu.Unlock()
	adapter.applySetCookieLocked(auth, setCookies)
	return &extprocv3.HeaderMutation{RemoveHeaders: []string{"set-cookie"}}, true
}

func (sessionCookieAuthAdapter) cookieReplacementLocked(auth *authContext, current string) (string, bool) {
	current = strings.TrimSpace(current)
	if current == "" || !strings.Contains(current, Placeholder) {
		return "", false
	}
	if current == Placeholder {
		if cookie := cookieHeaderMaterial(auth.Material); cookie != "" {
			return cookie, true
		}
		return "", false
	}
	parts := strings.Split(current, ";")
	replaced := false
	for index, part := range parts {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok || !strings.Contains(value, Placeholder) {
			continue
		}
		material := cookiePairMaterial(auth.Material, key)
		if material == "" {
			continue
		}
		parts[index] = strings.TrimSpace(key) + "=" + strings.ReplaceAll(value, Placeholder, material)
		replaced = true
	}
	if !replaced {
		return "", false
	}
	cookie := strings.Join(parts, "; ")
	setMaterial(auth.Material, "cookie", cookie)
	return cookie, true
}

func (sessionCookieAuthAdapter) applySetCookieLocked(auth *authContext, values []string) {
	header := http.Header{}
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			header.Add("Set-Cookie", value)
		}
	}
	cookies := (&http.Response{Header: header}).Cookies()
	if len(cookies) == 0 {
		return
	}
	jar := parseCookieHeader(cookieHeaderMaterial(auth.Material))
	for _, cookie := range cookies {
		if cookie == nil || strings.TrimSpace(cookie.Name) == "" {
			continue
		}
		name := strings.TrimSpace(cookie.Name)
		value := strings.TrimSpace(cookie.Value)
		if value == "" || cookie.MaxAge < 0 {
			delete(jar, name)
			setMaterial(auth.Material, name, "")
			setMaterial(auth.Material, normalizeMaterialKey(name), "")
			continue
		}
		jar[name] = value
		setMaterial(auth.Material, name, value)
		setMaterial(auth.Material, normalizeMaterialKey(name), value)
	}
	setMaterial(auth.Material, "cookie", formatCookieHeader(jar))
}

func cookieMaterialPresent(material map[string]string) bool {
	return cookieHeaderMaterial(material) != ""
}

func cookieHeaderMaterial(material map[string]string) string {
	if value := materialByKey(material, "cookie"); value != "" {
		return value
	}
	return ""
}

func cookiePairMaterial(material map[string]string, name string) string {
	if value := cookieValue(cookieHeaderMaterial(material), name); value != "" {
		return value
	}
	if value := materialByKey(material, name); value != "" {
		return value
	}
	if strings.HasPrefix(name, "__Secure-") {
		return materialByKey(material, strings.TrimPrefix(name, "__Secure-"))
	}
	return ""
}

func parseCookieHeader(header string) map[string]string {
	jar := map[string]string{}
	for _, part := range strings.Split(header, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key != "" && value != "" {
			jar[key] = value
		}
	}
	return jar
}

func cookieValue(header string, name string) string {
	name = strings.TrimSpace(name)
	for key, value := range parseCookieHeader(header) {
		if key == name {
			return value
		}
	}
	return ""
}

func formatCookieHeader(jar map[string]string) string {
	if len(jar) == 0 {
		return ""
	}
	keys := make([]string, 0, len(jar))
	for key := range jar {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		if value := strings.TrimSpace(jar[key]); value != "" {
			pairs = append(pairs, key+"="+value)
		}
	}
	return strings.Join(pairs, "; ")
}
