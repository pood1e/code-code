package sessionapi

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"code-code.internal/go-contract/domainerror"
	observabilityv1 "code-code.internal/go-contract/observability/v1"
	agentrunv1 "code-code.internal/go-contract/platform/agent_run/v1"
	managementv1 "code-code.internal/go-contract/platform/management/v1"
	"code-code.internal/platform-k8s/agentruns"
	"code-code.internal/platform-k8s/egressauth"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

func (s *SessionServer) ResolveAgentRunRuntimeContext(ctx context.Context, request *managementv1.ResolveAgentRunRuntimeContextRequest) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	if request == nil {
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: runtime context request is required"))
	}
	switch source := request.GetSource().(type) {
	case *managementv1.ResolveAgentRunRuntimeContextRequest_RunId:
		return s.resolveAgentRunRuntimeContextByRunID(ctx, source.RunId)
	case *managementv1.ResolveAgentRunRuntimeContextRequest_WorkloadId:
		return s.resolveAgentRunRuntimeContextByWorkloadID(ctx, source.WorkloadId)
	case *managementv1.ResolveAgentRunRuntimeContextRequest_Pod:
		return s.resolveAgentRunRuntimeContextByPod(ctx, source.Pod)
	default:
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: runtime context source is required"))
	}
}

func (s *SessionServer) resolveAgentRunRuntimeContextByRunID(ctx context.Context, runID string) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: run_id is required"))
	}
	run, err := s.agentRuns.Get(ctx, runID)
	if err != nil {
		return nil, grpcError(err)
	}
	pod, err := s.podForRun(ctx, runID)
	if err != nil {
		return nil, grpcError(err)
	}
	response, err := s.runtimeContextResponse(ctx, run, pod)
	if err != nil {
		return nil, grpcError(err)
	}
	return response, nil
}

func (s *SessionServer) resolveAgentRunRuntimeContextByWorkloadID(ctx context.Context, workloadID string) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	workloadID = strings.TrimSpace(workloadID)
	if workloadID == "" {
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: workload_id is required"))
	}
	run, err := s.agentRuns.Get(ctx, workloadID)
	if err != nil {
		return nil, grpcError(err)
	}
	pod, err := s.podForRun(ctx, workloadID)
	if err != nil {
		return nil, grpcError(err)
	}
	response, err := s.runtimeContextResponse(ctx, run, pod)
	if err != nil {
		return nil, grpcError(err)
	}
	return response, nil
}

func (s *SessionServer) resolveAgentRunRuntimeContextByPod(ctx context.Context, ref *managementv1.AgentRunPodRef) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	pod, err := s.resolveRuntimePod(ctx, ref)
	if err != nil {
		return nil, grpcError(err)
	}
	runID := strings.TrimSpace(pod.GetLabels()[agentruns.RunIDLabelKey])
	if runID == "" {
		return nil, grpcError(domainerror.NewValidation("platformk8s/sessionapi: runtime pod %s/%s is missing %s label", pod.Namespace, pod.Name, agentruns.RunIDLabelKey))
	}
	run, err := s.agentRuns.Get(ctx, runID)
	if err != nil {
		return nil, grpcError(err)
	}
	response, err := s.runtimeContextResponse(ctx, run, pod)
	if err != nil {
		return nil, grpcError(err)
	}
	return response, nil
}

func (s *SessionServer) resolveRuntimePod(ctx context.Context, ref *managementv1.AgentRunPodRef) (*corev1.Pod, error) {
	if ref == nil {
		return nil, domainerror.NewValidation("platformk8s/sessionapi: pod ref is required")
	}
	namespace := firstNonEmptyString(ref.GetNamespace(), s.runtimeNamespace, s.namespace)
	name := strings.TrimSpace(ref.GetName())
	uid := strings.TrimSpace(ref.GetUid())
	ip := strings.TrimSpace(ref.GetIp())
	if namespace == "" {
		return nil, domainerror.NewValidation("platformk8s/sessionapi: pod namespace is required")
	}
	if s.runtimeClient == nil {
		return nil, domainerror.NewValidation("platformk8s/sessionapi: runtime client is unavailable")
	}
	if name != "" {
		pod := &corev1.Pod{}
		if err := s.runtimeClient.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, pod); err != nil {
			return nil, err
		}
		if err := validatePodRef(pod, uid, ip); err != nil {
			return nil, err
		}
		return pod, nil
	}
	if uid == "" && ip == "" {
		return nil, domainerror.NewValidation("platformk8s/sessionapi: pod name, uid, or ip is required")
	}
	pods := &corev1.PodList{}
	if err := s.runtimeClient.List(ctx, pods, ctrlclient.InNamespace(namespace)); err != nil {
		return nil, err
	}
	var match *corev1.Pod
	for index := range pods.Items {
		pod := &pods.Items[index]
		if uid != "" && string(pod.UID) != uid {
			continue
		}
		if ip != "" && !podHasIP(pod, ip) {
			continue
		}
		if match != nil {
			return nil, domainerror.NewValidation("platformk8s/sessionapi: pod ref matched multiple pods in namespace %s", namespace)
		}
		match = pod
	}
	if match == nil {
		return nil, domainerror.NewNotFound("platformk8s/sessionapi: runtime pod not found in namespace %s", namespace)
	}
	return match, nil
}

func (s *SessionServer) podForRun(ctx context.Context, runID string) (*corev1.Pod, error) {
	runID = strings.TrimSpace(runID)
	if runID == "" || s.runtimeClient == nil {
		return nil, nil
	}
	namespace := firstNonEmptyString(s.runtimeNamespace, s.namespace)
	if namespace == "" {
		return nil, nil
	}
	pods := &corev1.PodList{}
	err := s.runtimeClient.List(ctx, pods,
		ctrlclient.InNamespace(namespace),
		ctrlclient.MatchingLabels{agentruns.RunIDLabelKey: runID},
	)
	if err != nil {
		return nil, err
	}
	if len(pods.Items) == 0 {
		return nil, nil
	}
	selected := &pods.Items[0]
	for index := 1; index < len(pods.Items); index++ {
		candidate := &pods.Items[index]
		if candidate.CreationTimestamp.After(selected.CreationTimestamp.Time) {
			selected = candidate
		}
	}
	return selected, nil
}

func validatePodRef(pod *corev1.Pod, uid string, ip string) error {
	if pod == nil {
		return domainerror.NewValidation("platformk8s/sessionapi: pod is required")
	}
	if uid != "" && string(pod.UID) != uid {
		return domainerror.NewValidation("platformk8s/sessionapi: pod uid does not match")
	}
	if ip != "" && !podHasIP(pod, ip) {
		return domainerror.NewValidation("platformk8s/sessionapi: pod ip does not match")
	}
	return nil
}

func podHasIP(pod *corev1.Pod, ip string) bool {
	ip = strings.TrimSpace(ip)
	if pod == nil || ip == "" {
		return false
	}
	if strings.TrimSpace(pod.Status.PodIP) == ip {
		return true
	}
	for _, value := range pod.Status.PodIPs {
		if strings.TrimSpace(value.IP) == ip {
			return true
		}
	}
	return false
}

func podRefFromPod(pod *corev1.Pod) *managementv1.AgentRunPodRef {
	if pod == nil {
		return nil
	}
	return &managementv1.AgentRunPodRef{
		Namespace: strings.TrimSpace(pod.Namespace),
		Name:      strings.TrimSpace(pod.Name),
		Uid:       strings.TrimSpace(string(pod.UID)),
		Ip:        strings.TrimSpace(pod.Status.PodIP),
	}
}

func (s *SessionServer) runtimeContextResponse(ctx context.Context, run *agentrunv1.AgentRunState, pod *corev1.Pod) (*managementv1.ResolveAgentRunRuntimeContextResponse, error) {
	metadata, err := s.runtimeMetadataFromRun(ctx, run)
	if err != nil {
		return nil, err
	}
	return &managementv1.ResolveAgentRunRuntimeContextResponse{
		Run:      run,
		Pod:      podRefFromPod(pod),
		Metadata: metadata,
	}, nil
}

func (s *SessionServer) runtimeMetadataFromRun(ctx context.Context, run *agentrunv1.AgentRunState) (*managementv1.AgentRunRuntimeMetadata, error) {
	if run == nil || run.GetSpec() == nil {
		return nil, nil
	}
	metadata := &managementv1.AgentRunRuntimeMetadata{
		ProviderId: "",
		CliId:      strings.TrimSpace(run.GetSpec().GetAgentRuntimeId()),
		ImageId:    strings.TrimSpace(run.GetSpec().GetContainerImage()),
	}
	if binding := run.GetSpec().GetAuthRequirement().GetProviderRunBinding(); binding != nil {
		metadata.CliId = firstNonEmptyString(binding.GetRuntimeCliId(), run.GetSpec().GetAgentRuntimeId())
		metadata.ProviderId = firstNonEmptyString(binding.GetProviderId(), metadata.GetProviderId())
		metadata.CredentialId = strings.TrimSpace(binding.GetCredentialGrantRef().GetGrantId())
		metadata.RuntimeUrl = strings.TrimSpace(binding.GetRuntimeUrl())
		metadata.AuthMaterializationKey = strings.TrimSpace(binding.GetMaterializationKey())
		if api := binding.GetApi(); api != nil {
			metadata.Protocol = api.GetProtocol()
		}
		metadata.ModelId = firstNonEmptyString(binding.GetProviderModelId(), binding.GetCanonicalModelId(), binding.GetSourceModelId())
	}
	if err := s.addRuntimeAuthProjectionMetadata(ctx, run.GetSpec().GetRunId(), metadata); err != nil {
		return nil, err
	}
	return metadata, nil
}

func (s *SessionServer) addRuntimeAuthProjectionMetadata(ctx context.Context, runID string, metadata *managementv1.AgentRunRuntimeMetadata) error {
	runID = strings.TrimSpace(runID)
	if runID == "" || metadata == nil || s.runtimeClient == nil {
		return nil
	}
	namespace := firstNonEmptyString(s.runtimeNamespace, s.namespace)
	if namespace == "" {
		return nil
	}
	secrets := &corev1.SecretList{}
	err := s.runtimeClient.List(ctx, secrets,
		ctrlclient.InNamespace(namespace),
		ctrlclient.MatchingLabels{egressauth.ProjectedCredentialRunIDLabel: runID},
	)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	}
	if len(secrets.Items) == 0 {
		return nil
	}
	selected := &secrets.Items[0]
	for index := 1; index < len(secrets.Items); index++ {
		candidate := &secrets.Items[index]
		if candidate.CreationTimestamp.After(selected.CreationTimestamp.Time) {
			selected = candidate
		}
	}
	annotations := selected.GetAnnotations()
	metadata.TargetHosts = splitCommaAnnotation(annotations[egressauth.AnnotationTargetHosts])
	metadata.TargetPathPrefixes = splitCommaAnnotation(annotations[egressauth.AnnotationTargetPathPrefixes])
	metadata.RequestHeaderNames = splitCommaAnnotation(annotations[egressauth.AnnotationRequestHeaderNames])
	metadata.RequestHeaderReplacementRules = runtimeHeaderReplacementRulesFromAnnotation(annotations[egressauth.AnnotationRequestHeaderRulesJSON])
	metadata.ResponseHeaderReplacementRules = runtimeHeaderReplacementRulesFromAnnotation(annotations[egressauth.AnnotationResponseHeaderRulesJSON])
	metadata.ResponseHeaderMetricRules = runtimeResponseHeaderMetricRulesFromAnnotation(annotations[egressauth.AnnotationResponseHeaderMetricsJSON])
	metadata.HeaderValuePrefix = strings.TrimSpace(annotations[egressauth.AnnotationHeaderValuePrefix])
	metadata.EgressPolicyId = strings.TrimSpace(annotations[egressauth.AnnotationEgressPolicyID])
	metadata.AuthPolicyId = strings.TrimSpace(annotations[egressauth.AnnotationAuthPolicyID])
	metadata.HeaderMetricPolicyId = strings.TrimSpace(annotations[egressauth.AnnotationHeaderMetricPolicyID])
	if metadata.CliId == "" {
		metadata.CliId = strings.TrimSpace(annotations[egressauth.AnnotationCLIID])
	}
	if metadata.ProviderId == "" {
		metadata.ProviderId = strings.TrimSpace(annotations[egressauth.AnnotationProviderID])
	}
	if metadata.AuthMaterializationKey == "" {
		metadata.AuthMaterializationKey = strings.TrimSpace(annotations[egressauth.AnnotationAuthMaterializationKey])
	}
	if metadata.RuntimeUrl == "" {
		metadata.RuntimeUrl = strings.TrimSpace(annotations[egressauth.AnnotationRuntimeURL])
	}
	return nil
}

func runtimeHeaderReplacementRulesFromAnnotation(value string) []*managementv1.AgentRunRuntimeHeaderReplacementRule {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var rules []egressauth.SimpleReplacementRule
	if err := json.Unmarshal([]byte(value), &rules); err != nil {
		return nil
	}
	out := make([]*managementv1.AgentRunRuntimeHeaderReplacementRule, 0, len(rules))
	for _, rule := range rules {
		rule = egressauth.NormalizeSimpleReplacementRule(rule)
		if strings.TrimSpace(rule.HeaderName) == "" {
			continue
		}
		out = append(out, &managementv1.AgentRunRuntimeHeaderReplacementRule{
			Mode:              rule.Mode,
			HeaderName:        rule.HeaderName,
			MaterialKey:       rule.MaterialKey,
			HeaderValuePrefix: rule.HeaderValuePrefix,
			Template:          rule.Template,
		})
	}
	return out
}

func runtimeResponseHeaderMetricRulesFromAnnotation(value string) []*agentrunv1.AgentRunResponseHeaderRule {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var rules []responseHeaderMetricRuleAnnotation
	if err := json.Unmarshal([]byte(value), &rules); err != nil {
		return nil
	}
	out := make([]*agentrunv1.AgentRunResponseHeaderRule, 0, len(rules))
	for _, rule := range rules {
		headerName := strings.ToLower(strings.TrimSpace(rule.HeaderName))
		metricName := strings.TrimSpace(rule.MetricName)
		if headerName == "" || metricName == "" {
			continue
		}
		out = append(out, &agentrunv1.AgentRunResponseHeaderRule{
			HeaderName: headerName,
			MetricName: metricName,
			ValueType:  rule.ValueType.value(),
			Labels:     responseHeaderMetricLabels(rule.Labels),
			Context:    rule.Context.value(),
		})
	}
	return out
}

type responseHeaderMetricRuleAnnotation struct {
	HeaderName string                                  `json:"headerName"`
	MetricName string                                  `json:"metricName"`
	ValueType  responseHeaderMetricValueTypeAnnotation `json:"valueType"`
	Labels     []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	} `json:"labels"`
	Context responseHeaderMetricContextAnnotation `json:"context"`
}

type responseHeaderMetricValueTypeAnnotation struct {
	valueType observabilityv1.HeaderValueType
}

func (a *responseHeaderMetricValueTypeAnnotation) UnmarshalJSON(raw []byte) error {
	value := strings.TrimSpace(string(raw))
	if value == "" || value == "null" {
		a.valueType = observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED
		return nil
	}
	if parsed, err := strconv.ParseInt(value, 10, 32); err == nil {
		a.valueType = observabilityv1.HeaderValueType(parsed)
		return nil
	}
	var name string
	if err := json.Unmarshal(raw, &name); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		a.valueType = observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED
		return nil
	}
	if number, ok := observabilityv1.HeaderValueType_value[name]; ok {
		a.valueType = observabilityv1.HeaderValueType(number)
		return nil
	}
	normalized := "HEADER_VALUE_TYPE_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
	if number, ok := observabilityv1.HeaderValueType_value[normalized]; ok {
		a.valueType = observabilityv1.HeaderValueType(number)
		return nil
	}
	a.valueType = observabilityv1.HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED
	return nil
}

func (a responseHeaderMetricValueTypeAnnotation) value() observabilityv1.HeaderValueType {
	return a.valueType
}

type responseHeaderMetricContextAnnotation struct {
	context agentrunv1.AgentRunResponseHeaderRuleContext
}

func (a *responseHeaderMetricContextAnnotation) UnmarshalJSON(raw []byte) error {
	value := strings.TrimSpace(string(raw))
	if value == "" || value == "null" {
		a.context = agentrunv1.AgentRunResponseHeaderRuleContext_AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_UNSPECIFIED
		return nil
	}
	if parsed, err := strconv.ParseInt(value, 10, 32); err == nil {
		a.context = agentrunv1.AgentRunResponseHeaderRuleContext(parsed)
		return nil
	}
	var name string
	if err := json.Unmarshal(raw, &name); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		a.context = agentrunv1.AgentRunResponseHeaderRuleContext_AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_UNSPECIFIED
		return nil
	}
	if number, ok := agentrunv1.AgentRunResponseHeaderRuleContext_value[name]; ok {
		a.context = agentrunv1.AgentRunResponseHeaderRuleContext(number)
		return nil
	}
	normalized := "AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
	if number, ok := agentrunv1.AgentRunResponseHeaderRuleContext_value[normalized]; ok {
		a.context = agentrunv1.AgentRunResponseHeaderRuleContext(number)
		return nil
	}
	a.context = agentrunv1.AgentRunResponseHeaderRuleContext_AGENT_RUN_RESPONSE_HEADER_RULE_CONTEXT_UNSPECIFIED
	return nil
}

func (a responseHeaderMetricContextAnnotation) value() agentrunv1.AgentRunResponseHeaderRuleContext {
	return a.context
}

func responseHeaderMetricLabels(labels []struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}) []*agentrunv1.AgentRunMetricLabel {
	out := make([]*agentrunv1.AgentRunMetricLabel, 0, len(labels))
	for _, label := range labels {
		name := strings.TrimSpace(label.Name)
		value := strings.TrimSpace(label.Value)
		if name != "" && value != "" {
			out = append(out, &agentrunv1.AgentRunMetricLabel{Name: name, Value: value})
		}
	}
	return out
}

func splitCommaAnnotation(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}
