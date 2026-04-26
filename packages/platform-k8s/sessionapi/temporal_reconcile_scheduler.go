package sessionapi

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"code-code.internal/platform-k8s/temporalruntime"
	enumspb "go.temporal.io/api/enums/v1"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

const (
	TemporalTaskQueue = "platform-agent-runtime-service"

	AgentRuntimeReconcileWorkflowName = "platform.agentRuntime.reconcile"
	triggerReconcileActivityName      = "platform.agentRuntime.triggerReconcile"
)

type TemporalReconcileSchedulerConfig struct {
	Client             client.Client
	TaskQueue          string
	Namespace          string
	PlatformNamespace  string
	TriggerHTTPBaseURL string
}

type TemporalReconcileScheduler struct {
	client             client.Client
	taskQueue          string
	triggerHTTPBaseURL string
}

func NewTemporalReconcileScheduler(config TemporalReconcileSchedulerConfig) (*TemporalReconcileScheduler, error) {
	if config.Client == nil {
		return nil, fmt.Errorf("platformk8s/sessionapi: temporal client is nil")
	}
	taskQueue := strings.TrimSpace(config.TaskQueue)
	if taskQueue == "" {
		taskQueue = TemporalTaskQueue
	}
	platformNamespace := strings.TrimSpace(config.PlatformNamespace)
	if platformNamespace == "" {
		platformNamespace = strings.TrimSpace(config.Namespace)
	}
	if platformNamespace == "" {
		platformNamespace = "code-code"
	}
	baseURL := strings.TrimRight(strings.TrimSpace(config.TriggerHTTPBaseURL), "/")
	if baseURL == "" {
		baseURL = fmt.Sprintf("http://platform-agent-runtime-service.%s.svc.cluster.local:8080%s", platformNamespace, defaultReconcileHTTPActionBasePath)
	}
	return &TemporalReconcileScheduler{
		client:             config.Client,
		taskQueue:          taskQueue,
		triggerHTTPBaseURL: baseURL,
	}, nil
}

func (s *TemporalReconcileScheduler) ScheduleReconcile(ctx context.Context, request ReconcileScheduleRequest) error {
	input, err := temporalReconcileInput(request)
	if err != nil {
		return err
	}
	_, err = s.client.ExecuteWorkflow(ctx, client.StartWorkflowOptions{
		ID:                       temporalReconcileWorkflowID(request, input.Action),
		TaskQueue:                s.taskQueue,
		WorkflowIDConflictPolicy: enumspb.WORKFLOW_ID_CONFLICT_POLICY_USE_EXISTING,
	}, AgentRuntimeReconcileWorkflowName, input)
	return err
}

func RegisterTemporalWorkflows(worker worker.Worker, scheduler *TemporalReconcileScheduler) error {
	if worker == nil {
		return fmt.Errorf("platformk8s/sessionapi: temporal worker is nil")
	}
	if scheduler == nil {
		return fmt.Errorf("platformk8s/sessionapi: temporal reconcile scheduler is nil")
	}
	worker.RegisterWorkflowWithOptions(AgentRuntimeReconcileWorkflow, workflow.RegisterOptions{Name: AgentRuntimeReconcileWorkflowName})
	activities := &TemporalReconcileActivities{baseURL: scheduler.triggerHTTPBaseURL}
	worker.RegisterActivityWithOptions(activities.TriggerReconcile, activity.RegisterOptions{Name: triggerReconcileActivityName})
	return nil
}

type TemporalReconcileInput struct {
	Action string
	Body   []byte
	Delay  time.Duration
}

func AgentRuntimeReconcileWorkflow(ctx workflow.Context, input TemporalReconcileInput) error {
	delay := input.Delay
	if delay <= 0 {
		delay = defaultRequeueDelay
	}
	if err := workflow.Sleep(ctx, delay); err != nil {
		return err
	}
	options := workflow.ActivityOptions{
		StartToCloseTimeout: time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval: time.Second,
			MaximumInterval: 30 * time.Second,
			MaximumAttempts: 3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, options)
	return workflow.ExecuteActivity(ctx, triggerReconcileActivityName, input).Get(ctx, nil)
}

type TemporalReconcileActivities struct {
	baseURL string
}

func (a *TemporalReconcileActivities) TriggerReconcile(ctx context.Context, input TemporalReconcileInput) error {
	url := strings.TrimRight(a.baseURL, "/") + "/" + strings.TrimSpace(input.Action)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(input.Body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("platformk8s/sessionapi: trigger reconcile %q returned %s", input.Action, response.Status)
	}
	return nil
}

func temporalReconcileInput(request ReconcileScheduleRequest) (TemporalReconcileInput, error) {
	action := strings.TrimSpace(request.Action)
	if action == "" || strings.Contains(action, "/") {
		return TemporalReconcileInput{}, fmt.Errorf("platformk8s/sessionapi: reconcile action is invalid")
	}
	body := bytes.TrimSpace(request.Body)
	if len(body) == 0 {
		body = []byte("{}")
	}
	return TemporalReconcileInput{Action: action, Body: body, Delay: request.Delay}, nil
}

func temporalReconcileWorkflowID(request ReconcileScheduleRequest, action string) string {
	return "agent-runtime-reconcile-" + temporalruntime.IDPart(request.OwnerKind+"-"+request.OwnerID+"-"+action, "runtime")
}
