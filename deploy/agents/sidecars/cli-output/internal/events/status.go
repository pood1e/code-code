package events

import (
	"encoding/json"
	"os"

	resultv1 "code-code.internal/go-contract/agent/result/v1"
	runeventv1 "code-code.internal/go-contract/platform/run_event/v1"
)

type terminalState struct {
	ExitCode int `json:"exit_code"`
}

type stopState struct {
	Force bool `json:"force"`
}

func ResultFromTerminal(terminalPath, stopPath string) (*resultv1.RunResult, runeventv1.RunStatusPhase, error) {
	terminal := terminalState{}
	if err := decodeJSONFile(terminalPath, &terminal); err != nil {
		return nil, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_UNSPECIFIED, err
	}
	stop := stopState{}
	_ = decodeJSONFile(stopPath, &stop)
	if terminal.ExitCode == 0 {
		return &resultv1.RunResult{Status: resultv1.RunStatus_RUN_STATUS_COMPLETED}, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_COMPLETED, nil
	}
	if stop.Force {
		return &resultv1.RunResult{Status: resultv1.RunStatus_RUN_STATUS_INTERRUPTED}, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_CANCELLED, nil
	}
	if fileExists(stopPath) {
		return &resultv1.RunResult{Status: resultv1.RunStatus_RUN_STATUS_CANCELLED}, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_CANCELLED, nil
	}
	return &resultv1.RunResult{
		Status: resultv1.RunStatus_RUN_STATUS_FAILED,
		Error: &resultv1.RunError{
			Code:    "cli_exit",
			Message: "CLI process exited with non-zero status",
		},
	}, runeventv1.RunStatusPhase_RUN_STATUS_PHASE_FAILED, nil
}

func decodeJSONFile(path string, target any) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
