package credentials

import (
	"strings"
	"testing"
	"time"

	credentialv1 "code-code.internal/go-contract/credential/v1"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	"code-code.internal/platform-k8s/internal/testutil"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	ctrlclientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestMaterialReconcilerMarksMissingSecretNotReady(t *testing.T) {
	t.Parallel()

	reconciler, client := newMaterialReconcilerForTest(
		t,
		time.Unix(1700000000, 0).UTC(),
		testCredentialResource("provider-key", credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY, 3, nil),
	)

	if _, err := reconciler.Reconcile(t.Context(), ctrl.Request{
		NamespacedName: types.NamespacedName{Namespace: "code-code", Name: "provider-key"},
	}); err != nil {
		t.Fatalf("Reconcile() error = %v", err)
	}

	resource := getCredentialResourceForTest(t, client, "provider-key")
	condition := meta.FindStatusCondition(resource.Status.Conditions, ConditionCredentialMaterialReady)
	if condition == nil {
		t.Fatal("MaterialReady condition = nil")
	}
	if got, want := condition.Status, metav1.ConditionFalse; got != want {
		t.Fatalf("status = %s, want %s", got, want)
	}
	if !strings.Contains(condition.Message, "backing secret") {
		t.Fatalf("message = %q, want backing secret validation error", condition.Message)
	}
}

func TestMaterialReconcilerMarksValidSecretReady(t *testing.T) {
	t.Parallel()

	reconciler, client := newMaterialReconcilerForTest(
		t,
		time.Unix(1700000000, 0).UTC(),
		testCredentialResource("provider-key", credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY, 5, nil),
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "provider-key", Namespace: "code-code"},
			Data:       map[string][]byte{"api_key": []byte("secret-value")},
		},
	)

	if _, err := reconciler.Reconcile(t.Context(), ctrl.Request{
		NamespacedName: types.NamespacedName{Namespace: "code-code", Name: "provider-key"},
	}); err != nil {
		t.Fatalf("Reconcile() error = %v", err)
	}

	resource := getCredentialResourceForTest(t, client, "provider-key")
	condition := meta.FindStatusCondition(resource.Status.Conditions, ConditionCredentialMaterialReady)
	if condition == nil {
		t.Fatal("MaterialReady condition = nil")
	}
	if got, want := condition.Status, metav1.ConditionTrue; got != want {
		t.Fatalf("status = %s, want %s", got, want)
	}
	if got, want := resource.Status.ObservedGeneration, int64(5); got != want {
		t.Fatalf("observedGeneration = %d, want %d", got, want)
	}
}

func TestMaterialReconcilerPreservesTransitionTimeOnNoop(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0).UTC()
	reconciler, client := newMaterialReconcilerForTest(
		t,
		now,
		testCredentialResource("provider-key", credentialv1.CredentialKind_CREDENTIAL_KIND_API_KEY, 7, nil),
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "provider-key", Namespace: "code-code"},
			Data:       map[string][]byte{"api_key": []byte("secret-value")},
		},
	)
	key := types.NamespacedName{Namespace: "code-code", Name: "provider-key"}

	if _, err := reconciler.Reconcile(t.Context(), ctrl.Request{NamespacedName: key}); err != nil {
		t.Fatalf("Reconcile() error = %v", err)
	}
	first := meta.FindStatusCondition(getCredentialResourceForTest(t, client, "provider-key").Status.Conditions, ConditionCredentialMaterialReady)
	if first == nil {
		t.Fatal("first MaterialReady condition = nil")
	}

	now = now.Add(time.Hour)
	reconciler.now = func() time.Time { return now }
	if _, err := reconciler.Reconcile(t.Context(), ctrl.Request{NamespacedName: key}); err != nil {
		t.Fatalf("Reconcile() error = %v", err)
	}
	second := meta.FindStatusCondition(getCredentialResourceForTest(t, client, "provider-key").Status.Conditions, ConditionCredentialMaterialReady)
	if second == nil {
		t.Fatal("second MaterialReady condition = nil")
	}
	if !first.LastTransitionTime.Time.Equal(second.LastTransitionTime.Time) {
		t.Fatalf("LastTransitionTime changed on noop reconcile: %s -> %s", first.LastTransitionTime, second.LastTransitionTime)
	}
}

func newMaterialReconcilerForTest(
	t *testing.T,
	now time.Time,
	objects ...ctrlclient.Object,
) (*MaterialReconciler, ctrlclient.Client) {
	t.Helper()

	client := ctrlclientfake.NewClientBuilder().
		WithScheme(testutil.NewScheme()).
		WithStatusSubresource(&platformv1alpha1.CredentialDefinitionResource{}).
		WithObjects(objects...).
		Build()
	reconciler, err := NewMaterialReconciler(MaterialReconcilerConfig{
		Client:    client,
		Namespace: "code-code",
		Now:       func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewMaterialReconciler() error = %v", err)
	}
	return reconciler, client
}

func getCredentialResourceForTest(t *testing.T, client ctrlclient.Client, name string) *platformv1alpha1.CredentialDefinitionResource {
	t.Helper()

	resource := &platformv1alpha1.CredentialDefinitionResource{}
	if err := client.Get(t.Context(), types.NamespacedName{Namespace: "code-code", Name: name}, resource); err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	return resource
}
