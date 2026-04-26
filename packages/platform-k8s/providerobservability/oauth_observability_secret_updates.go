package providerobservability

import (
	"context"
	"strings"

	corev1 "k8s.io/api/core/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func (r *OAuthObservabilityRunner) persistCredentialSecretData(
	ctx context.Context,
	secretName string,
	updates map[string]string,
) error {
	secretName = strings.TrimSpace(secretName)
	if r == nil || r.client == nil || secretName == "" || len(updates) == 0 {
		return nil
	}
	secret := &corev1.Secret{}
	if err := retryObservabilityTransientPlatform(ctx, func() error {
		return r.client.Get(ctx, ctrlclient.ObjectKey{Namespace: r.namespace, Name: secretName}, secret)
	}); err != nil {
		return err
	}
	if secret.Data == nil {
		secret.Data = map[string][]byte{}
	}
	changed := false
	for key, value := range updates {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		if string(secret.Data[trimmedKey]) == trimmedValue {
			continue
		}
		secret.Data[trimmedKey] = []byte(trimmedValue)
		changed = true
	}
	if !changed {
		return nil
	}
	return retryObservabilityTransientPlatform(ctx, func() error {
		return r.client.Update(ctx, secret)
	})
}
