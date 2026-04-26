package agentsessionactionquery

import (
	"context"
	"strings"

	agentsessionactionv1 "code-code.internal/go-contract/platform/agent_session_action/v1"
	platformv1alpha1 "code-code.internal/platform-k8s/api/v1alpha1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	sessionIDLabelKey = "agentsessionaction.code-code.internal/session-id"
	typeLabelKey      = "agentsessionaction.code-code.internal/type"
)

func HasNonterminalResetWarmState(ctx context.Context, reader ctrlclient.Reader, namespace string, sessionID string) (bool, error) {
	if reader == nil {
		return false, nil
	}
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return false, nil
	}
	list := &platformv1alpha1.AgentSessionActionResourceList{}
	if err := reader.List(
		ctx,
		list,
		ctrlclient.InNamespace(strings.TrimSpace(namespace)),
		ctrlclient.MatchingLabels(map[string]string{
			sessionIDLabelKey: sessionID,
			typeLabelKey:      agentsessionactionv1.AgentSessionActionType_AGENT_SESSION_ACTION_TYPE_RESET_WARM_STATE.String(),
		}),
	); err != nil {
		return false, err
	}
	for i := range list.Items {
		if isTerminalPhase(list.Items[i].Status.Phase) {
			continue
		}
		return true, nil
	}
	return false, nil
}

func isTerminalPhase(phase platformv1alpha1.AgentSessionActionResourcePhase) bool {
	switch phase {
	case platformv1alpha1.AgentSessionActionResourcePhaseSucceeded,
		platformv1alpha1.AgentSessionActionResourcePhaseFailed,
		platformv1alpha1.AgentSessionActionResourcePhaseCanceled:
		return true
	default:
		return false
	}
}
