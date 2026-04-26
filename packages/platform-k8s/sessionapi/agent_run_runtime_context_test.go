package sessionapi

import (
	"context"
	"testing"
	"time"

	resultv1 "code-code.internal/go-contract/agent/result/v1"
	apiprotocolv1 "code-code.internal/go-contract/api_protocol/v1"
	credentialv1 "code-code.internal/go-contract/credential/v1"
	observabilityv1 "code-code.internal/go-contract/observability/v1"
	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	providerv1 "code-code.internal/go-contract/provider/v1"
	"code-code.internal/platform-k8s/agentruns"
	"code-code.internal/platform-k8s/egressauth"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	fake "sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestResolveAgentRunRuntimeContextByPodUsesRunLabel(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("add core scheme: %v", err)
	}
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "code-code-runs",
			Name:      "run-1-pod",
			UID:       types.UID("pod-uid-1"),
			Labels:    map[string]string{agentruns.RunIDLabelKey: "run-1"},
		},
		Status: corev1.PodStatus{PodIP: "10.0.0.12"},
	}
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "code-code-runs",
			Name:      "run-1-auth",
			Labels: map[string]string{
				egressauth.ProjectedCredentialRunIDLabel: "run-1",
			},
			Annotations: map[string]string{
				egressauth.AnnotationTargetHosts:               "api.example.test",
				egressauth.AnnotationTargetPathPrefixes:        "/v1,/oauth2",
				egressauth.AnnotationRequestHeaderNames:        "authorization,cookie",
				egressauth.AnnotationResponseHeaderRulesJSON:   `[{"headerName":"x-session-id","materialKey":"session_id","template":"x-session-id=PLACEHOLDER"}]`,
				egressauth.AnnotationResponseHeaderMetricsJSON: `[{"headerName":"x-ratelimit-remaining","metricName":"gen_ai.provider.runtime.rate_limit.remaining","valueType":"HEADER_VALUE_TYPE_DOUBLE","context":"AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_VENDOR_RUNTIME"}]`,
				egressauth.AnnotationHeaderValuePrefix:         "Bearer",
			},
		},
	}
	runs := &runtimeContextAgentRunService{runs: map[string]*agentrunv1.AgentRunState{
		"run-1": testAgentRunState("run-1"),
	}}
	server := &SessionServer{
		runtimeNamespace: "code-code-runs",
		runtimeClient:    fake.NewClientBuilder().WithScheme(scheme).WithObjects(pod, secret).Build(),
		agentRuns:        runs,
	}

	response, err := server.ResolveAgentRunRuntimeContext(context.Background(), &managementv1.ResolveAgentRunRuntimeContextRequest{
		Source: &managementv1.ResolveAgentRunRuntimeContextRequest_Pod{Pod: &managementv1.AgentRunPodRef{
			Namespace: "code-code-runs",
			Name:      "run-1-pod",
			Uid:       "pod-uid-1",
			Ip:        "10.0.0.12",
		}},
	})
	if err != nil {
		t.Fatalf("ResolveAgentRunRuntimeContext() error = %v", err)
	}
	if got, want := runs.getID, "run-1"; got != want {
		t.Fatalf("agentRuns.Get id = %q, want %q", got, want)
	}
	if got, want := response.GetRun().GetSpec().GetAuthRequirement().GetProviderRunBinding().GetRuntimeCliId(), "codex"; got != want {
		t.Fatalf("runtime_cli_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetCliId(), "codex"; got != want {
		t.Fatalf("metadata.cli_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetProviderId(), "provider-account-1"; got != want {
		t.Fatalf("metadata.provider_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetProtocol(), apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE; got != want {
		t.Fatalf("metadata.protocol = %s, want %s", got.String(), want.String())
	}
	if got, want := response.GetMetadata().GetModelId(), "gpt-5"; got != want {
		t.Fatalf("metadata.model_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetImageId(), "registry.local/codex-runtime:gpt5"; got != want {
		t.Fatalf("metadata.image_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetCredentialId(), "cred-1"; got != want {
		t.Fatalf("metadata.credential_id = %q, want %q", got, want)
	}
	if got, want := response.GetMetadata().GetTargetHosts(), []string{"api.example.test"}; len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("metadata.target_hosts = %v, want %v", got, want)
	}
	if got, want := response.GetMetadata().GetTargetPathPrefixes(), []string{"/v1", "/oauth2"}; len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("metadata.target_path_prefixes = %v, want %v", got, want)
	}
	if got, want := response.GetMetadata().GetRequestHeaderNames(), []string{"authorization", "cookie"}; len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("metadata.request_header_names = %v, want %v", got, want)
	}
	if got := response.GetMetadata().GetResponseHeaderMetricRules(); len(got) != 1 || got[0].GetHeaderName() != "x-ratelimit-remaining" || got[0].GetValueType() != observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_DOUBLE {
		t.Fatalf("metadata.response_header_metric_rules = %#v", got)
	}
	if got := response.GetMetadata().GetResponseHeaderMetricRules()[0].GetContext(); got != agentrunv1.AgentRunResponseHeaderRuleContext_AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_VENDOR_RUNTIME {
		t.Fatalf("metadata.response_header_metric_rules[0].context = %s", got.String())
	}
	if got := response.GetMetadata().GetResponseHeaderReplacementRules(); len(got) != 1 || got[0].GetHeaderName() != "x-session-id" {
		t.Fatalf("metadata.response_header_replacement_rules = %#v", got)
	}
	if got, want := response.GetPod().GetUid(), "pod-uid-1"; got != want {
		t.Fatalf("pod.uid = %q, want %q", got, want)
	}
}

func TestResolveAgentRunRuntimeContextByRunIDReturnsFrozenRun(t *testing.T) {
	t.Parallel()

	runs := &runtimeContextAgentRunService{runs: map[string]*agentrunv1.AgentRunState{
		"run-2": testAgentRunState("run-2"),
	}}
	server := &SessionServer{agentRuns: runs}

	response, err := server.ResolveAgentRunRuntimeContext(context.Background(), &managementv1.ResolveAgentRunRuntimeContextRequest{
		Source: &managementv1.ResolveAgentRunRuntimeContextRequest_RunId{RunId: "run-2"},
	})
	if err != nil {
		t.Fatalf("ResolveAgentRunRuntimeContext() error = %v", err)
	}
	if got, want := response.GetRun().GetSpec().GetRunId(), "run-2"; got != want {
		t.Fatalf("run_id = %q, want %q", got, want)
	}
	if response.GetPod() != nil {
		t.Fatalf("pod = %#v, want nil", response.GetPod())
	}
	if got, want := response.GetMetadata().GetModelId(), "gpt-5"; got != want {
		t.Fatalf("metadata.model_id = %q, want %q", got, want)
	}
}

func TestRecordAgentRunResponseHeadersAppliesResponseTargetAndRules(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("add core scheme: %v", err)
	}
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "code-code-runs",
			Name:      "run-metrics-pod",
			Labels:    map[string]string{agentruns.RunIDLabelKey: "run-metrics"},
		},
		Status: corev1.PodStatus{PodIP: "10.0.0.20"},
	}
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "code-code-runs",
			Name:      "run-metrics-auth",
			Labels: map[string]string{
				egressauth.ProjectedCredentialRunIDLabel: "run-metrics",
			},
			Annotations: map[string]string{
				egressauth.AnnotationTargetHosts:               "api.example.test",
				egressauth.AnnotationTargetPathPrefixes:        "/v1",
				egressauth.AnnotationResponseHeaderMetricsJSON: `[{"headerName":"x-ratelimit-remaining","metricName":"gen_ai.provider.runtime.rate_limit.remaining","valueType":2}]`,
			},
		},
	}
	runs := &runtimeContextAgentRunService{runs: map[string]*agentrunv1.AgentRunState{
		"run-metrics": testAgentRunState("run-metrics"),
	}}
	server := &SessionServer{
		runtimeNamespace: "code-code-runs",
		runtimeClient:    fake.NewClientBuilder().WithScheme(scheme).WithObjects(pod, secret).Build(),
		agentRuns:        runs,
	}

	response, err := server.RecordAgentRunResponseHeaders(context.Background(), &managementv1.RecordAgentRunResponseHeadersRequest{
		Source: &managementv1.RecordAgentRunResponseHeadersRequest_Pod{Pod: &managementv1.AgentRunPodRef{
			Namespace: "code-code-runs",
			Ip:        "10.0.0.20",
		}},
		TargetHost: "api.example.test",
		TargetPath: "/v1/chat/completions",
		StatusCode: 200,
		ResponseHeaders: map[string]string{
			"x-ratelimit-remaining": "42",
		},
	})
	if err != nil {
		t.Fatalf("RecordAgentRunResponseHeaders() error = %v", err)
	}
	if !response.GetRecorded() || response.GetSkipped() {
		t.Fatalf("RecordAgentRunResponseHeaders() = %#v, want recorded", response)
	}
}

func TestResolveAgentRunRuntimeContextByWorkloadIDReturnsPodWhenPresent(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("add core scheme: %v", err)
	}
	oldPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:         "code-code-runs",
			Name:              "run-3-old",
			Labels:            map[string]string{agentruns.RunIDLabelKey: "run-3"},
			CreationTimestamp: metav1.NewTime(time.Unix(1, 0)),
		},
	}
	newPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:         "code-code-runs",
			Name:              "run-3-new",
			UID:               types.UID("pod-uid-3"),
			Labels:            map[string]string{agentruns.RunIDLabelKey: "run-3"},
			CreationTimestamp: metav1.NewTime(time.Unix(2, 0)),
		},
		Status: corev1.PodStatus{PodIP: "10.0.0.13"},
	}
	runs := &runtimeContextAgentRunService{runs: map[string]*agentrunv1.AgentRunState{
		"run-3": testAgentRunState("run-3"),
	}}
	server := &SessionServer{
		runtimeNamespace: "code-code-runs",
		runtimeClient:    fake.NewClientBuilder().WithScheme(scheme).WithObjects(oldPod, newPod).Build(),
		agentRuns:        runs,
	}

	response, err := server.ResolveAgentRunRuntimeContext(context.Background(), &managementv1.ResolveAgentRunRuntimeContextRequest{
		Source: &managementv1.ResolveAgentRunRuntimeContextRequest_WorkloadId{WorkloadId: "run-3"},
	})
	if err != nil {
		t.Fatalf("ResolveAgentRunRuntimeContext() error = %v", err)
	}
	if got, want := response.GetPod().GetName(), "run-3-new"; got != want {
		t.Fatalf("pod.name = %q, want %q", got, want)
	}
}

func TestResolveAgentRunRuntimeContextRejectsPodWithoutRunLabel(t *testing.T) {
	t.Parallel()

	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("add core scheme: %v", err)
	}
	pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Namespace: "code-code-runs", Name: "orphan"}}
	server := &SessionServer{
		runtimeNamespace: "code-code-runs",
		runtimeClient:    fake.NewClientBuilder().WithScheme(scheme).WithObjects(pod).Build(),
		agentRuns:        &runtimeContextAgentRunService{},
	}

	if _, err := server.ResolveAgentRunRuntimeContext(context.Background(), &managementv1.ResolveAgentRunRuntimeContextRequest{
		Source: &managementv1.ResolveAgentRunRuntimeContextRequest_Pod{Pod: &managementv1.AgentRunPodRef{Name: "orphan"}},
	}); err == nil {
		t.Fatal("ResolveAgentRunRuntimeContext() error = nil, want missing label error")
	}
}

type runtimeContextAgentRunService struct {
	getID string
	runs  map[string]*agentrunv1.AgentRunState
}

func (f *runtimeContextAgentRunService) Get(_ context.Context, runID string) (*agentrunv1.AgentRunState, error) {
	f.getID = runID
	return f.runs[runID], nil
}

func (f *runtimeContextAgentRunService) PublishTerminalResult(context.Context, string, *resultv1.RunResult) error {
	return nil
}

func testAgentRunState(runID string) *agentrunv1.AgentRunState {
	return &agentrunv1.AgentRunState{
		Spec: &agentrunv1.AgentRunSpec{
			RunId:          runID,
			SessionId:      "session-1",
			AgentRuntimeId: "codex",
			ContainerImage: "registry.local/codex-runtime:gpt5",
			AuthRequirement: &agentrunv1.AgentRunAuthRequirement{
				AuthStatus: "bound",
				ProviderRunBinding: &providerv1.ProviderRunBinding{
					ProviderId:         "provider-account-1",
					CredentialGrantRef: &credentialv1.CredentialGrantRef{GrantId: "cred-1"},
					RuntimeUrl:         "https://api.example.test/v1",
					MaterializationKey: "codex.openai-oauth",
					RuntimeCliId:       "codex",
					ProviderModelId:    "gpt-5",
					Access: &providerv1.ProviderRunBinding_Api{Api: &providerv1.ProviderRunAPIAccess{
						Protocol: apiprotocolv1.Protocol_PROTOCOL_OPENAI_COMPATIBLE,
					}},
				},
			},
		},
		Status: &agentrunv1.AgentRunStatus{Workload: &agentrunv1.WorkloadRef{WorkloadId: runID}},
	}
}
