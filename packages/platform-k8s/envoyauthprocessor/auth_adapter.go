package envoyauthprocessor

import (
	"strings"

	"code-code.internal/platform-k8s/egressauth"
	extprocv3 "github.com/envoyproxy/go-control-plane/envoy/service/ext_proc/v3"
)

const defaultAuthAdapterID = egressauth.AuthAdapterDefaultID

type authMaterialAdapter interface {
	ID() string
	HasMaterial(map[string]string) bool
	SerializesCookie() bool
	Replacement(*authContext, requestHeaders, string, string) (string, bool)
	ResponseMutation(*authContext, requestHeaders) (*extprocv3.HeaderMutation, bool)
}

type authMaterialAdapters map[string]authMaterialAdapter

func defaultAuthMaterialAdapters() authMaterialAdapters {
	return newAuthMaterialAdapters(
		defaultAuthAdapter{},
		sessionCookieAuthAdapter{},
		googleAIStudioSessionAuthAdapter{base: sessionCookieAuthAdapter{}},
	)
}

func newAuthMaterialAdapters(items ...authMaterialAdapter) authMaterialAdapters {
	adapters := authMaterialAdapters{}
	for _, item := range items {
		if item == nil {
			continue
		}
		id := strings.TrimSpace(item.ID())
		if id == "" {
			continue
		}
		adapters[id] = item
	}
	return adapters
}

func (adapters authMaterialAdapters) resolve(id string) authMaterialAdapter {
	id = strings.TrimSpace(id)
	if id == "" {
		id = defaultAuthAdapterID
	}
	if adapter := adapters[id]; adapter != nil {
		return adapter
	}
	return adapters[defaultAuthAdapterID]
}

func (auth *authContext) hasReplacementMaterial() bool {
	if auth == nil || auth.Adapter == nil {
		return false
	}
	auth.mu.Lock()
	defer auth.mu.Unlock()
	return auth.Adapter.HasMaterial(auth.Material)
}

func (auth *authContext) replacementForHeader(headers requestHeaders, name string, current string) (string, bool) {
	if auth == nil || auth.Adapter == nil {
		return "", false
	}
	return auth.Adapter.Replacement(auth, headers, name, current)
}
