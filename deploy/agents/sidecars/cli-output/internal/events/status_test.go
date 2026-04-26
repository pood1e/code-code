package events

import (
	"os"
	"path/filepath"
	"testing"

	resultv1 "code-code.internal/go-contract/agent/result/v1"
	runeventv1 "code-code.internal/go-contract/platform/run_event/v1"
)

func TestResultFromTerminalMapsStatuses(t *testing.T) {
	tempDir := t.TempDir()
	terminalPath := filepath.Join(tempDir, "terminal.json")
	stopPath := filepath.Join(tempDir, "stop.json")

	if err := os.WriteFile(terminalPath, []byte(`{"exit_code":0}`), 0o644); err != nil {
		t.Fatalf("WriteFile() terminal error = %v", err)
	}
	result, phase, err := ResultFromTerminal(terminalPath, stopPath)
	if err != nil || result.GetStatus() != resultv1.RunStatus_RUN_STATUS_COMPLETED || phase != runeventv1.RunStatusPhase_RUN_STATUS_PHASE_COMPLETED {
		t.Fatalf("completed mapping = %#v, %v, err=%v", result, phase, err)
	}

	if err := os.WriteFile(terminalPath, []byte(`{"exit_code":2}`), 0o644); err != nil {
		t.Fatalf("WriteFile() terminal error = %v", err)
	}
	if err := os.WriteFile(stopPath, []byte(`{"force":true}`), 0o644); err != nil {
		t.Fatalf("WriteFile() stop error = %v", err)
	}
	result, phase, err = ResultFromTerminal(terminalPath, stopPath)
	if err != nil || result.GetStatus() != resultv1.RunStatus_RUN_STATUS_INTERRUPTED || phase != runeventv1.RunStatusPhase_RUN_STATUS_PHASE_CANCELLED {
		t.Fatalf("interrupted mapping = %#v, %v, err=%v", result, phase, err)
	}
}
