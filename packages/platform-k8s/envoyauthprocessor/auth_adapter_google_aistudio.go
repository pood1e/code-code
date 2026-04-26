package envoyauthprocessor

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"code-code.internal/platform-k8s/egressauth"
	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

const googleAIStudioSessionAuthAdapterID = egressauth.AuthAdapterGoogleAIStudioSessionID

type googleAIStudioSessionAuthAdapter struct {
	base sessionCookieAuthAdapter
}

func (googleAIStudioSessionAuthAdapter) ID() string {
	return googleAIStudioSessionAuthAdapterID
}

func (adapter googleAIStudioSessionAuthAdapter) HasMaterial(material map[string]string) bool {
	return adapter.base.HasMaterial(material)
}

func (adapter googleAIStudioSessionAuthAdapter) SerializesCookie() bool {
	return adapter.base.SerializesCookie()
}

func (adapter googleAIStudioSessionAuthAdapter) Replacement(auth *authContext, headers requestHeaders, name string, current string) (string, bool) {
	switch normalizeMaterialKey(name) {
	case "authorization":
		auth.mu.Lock()
		defer auth.mu.Unlock()
		if !strings.Contains(current, Placeholder) {
			return "", false
		}
		return googleAIStudioAuthorizationHeader(cookieHeaderMaterial(auth.Material), requestOrigin(headers), time.Now().UTC())
	case "x_goog_api_key":
		auth.mu.Lock()
		defer auth.mu.Unlock()
		return replacementValue(current, "", firstMaterial(auth.Material, "page_api_key", "x_goog_api_key", "api_key"))
	default:
		return adapter.base.Replacement(auth, headers, name, current)
	}
}

func (adapter googleAIStudioSessionAuthAdapter) ResponseMutation(auth *authContext, headers requestHeaders) (*extprocv3.HeaderMutation, bool) {
	return adapter.base.ResponseMutation(auth, headers)
}

func requestOrigin(headers requestHeaders) string {
	if origin := strings.TrimSpace(headers.get("origin")); origin != "" {
		return origin
	}
	referer := strings.TrimSpace(headers.get("referer"))
	if referer == "" {
		return ""
	}
	parsed, err := url.Parse(referer)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func googleAIStudioAuthorizationHeader(cookieHeader string, origin string, now time.Time) (string, bool) {
	origin = strings.TrimSpace(origin)
	if cookieHeader == "" || origin == "" {
		return "", false
	}
	timestamp := now.Unix()
	tokens := make([]string, 0, 3)
	if token := googleAIStudioAuthorizationToken(cookieHeader, origin, timestamp, "SAPISIDHASH", "SAPISID", "__Secure-3PAPISID"); token != "" {
		tokens = append(tokens, token)
	}
	if token := googleAIStudioAuthorizationToken(cookieHeader, origin, timestamp, "SAPISID1PHASH", "__Secure-1PAPISID"); token != "" {
		tokens = append(tokens, token)
	}
	if token := googleAIStudioAuthorizationToken(cookieHeader, origin, timestamp, "SAPISID3PHASH", "__Secure-3PAPISID"); token != "" {
		tokens = append(tokens, token)
	}
	if len(tokens) == 0 {
		return "", false
	}
	return strings.Join(tokens, " "), true
}

func googleAIStudioAuthorizationToken(cookieHeader, origin string, timestamp int64, prefix string, cookieNames ...string) string {
	var value string
	for _, name := range cookieNames {
		value = cookieValue(cookieHeader, name)
		if value != "" {
			break
		}
	}
	if value == "" {
		return ""
	}
	plain := fmt.Sprintf("%d %s %s", timestamp, value, strings.TrimSpace(origin))
	digest := sha1.Sum([]byte(plain))
	return fmt.Sprintf("%s %d_%s", prefix, timestamp, hex.EncodeToString(digest[:]))
}
