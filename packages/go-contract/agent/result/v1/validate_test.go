package resultv1

import "testing"

func TestValidateRunResultAcceptsCompletedWithoutError(t *testing.T) {
	t.Parallel()

	result := &RunResult{Status: RunStatus_RUN_STATUS_COMPLETED}

	if err := ValidateRunResult(result); err != nil {
		t.Fatalf("ValidateRunResult() error = %v", err)
	}
}

func TestValidateRunResultRejectsCompletedWithError(t *testing.T) {
	t.Parallel()

	result := &RunResult{
		Status: RunStatus_RUN_STATUS_COMPLETED,
		Error:  &RunError{Code: "unexpected", Message: "unexpected"},
	}

	if err := ValidateRunResult(result); err == nil {
		t.Fatal("ValidateRunResult() expected error, got nil")
	}
}

func TestValidateRunResultRejectsFailedWithoutError(t *testing.T) {
	t.Parallel()

	result := &RunResult{Status: RunStatus_RUN_STATUS_FAILED}

	if err := ValidateRunResult(result); err == nil {
		t.Fatal("ValidateRunResult() expected error, got nil")
	}
}

func TestValidateRunResultAcceptsInterruptedWithResumeToken(t *testing.T) {
	t.Parallel()

	result := &RunResult{
		Status:      RunStatus_RUN_STATUS_INTERRUPTED,
		ResumeToken: "resume-1",
	}

	if err := ValidateRunResult(result); err != nil {
		t.Fatalf("ValidateRunResult() error = %v", err)
	}
}

func TestValidateRunResultRejectsInterruptedWithoutResumeToken(t *testing.T) {
	t.Parallel()

	result := &RunResult{Status: RunStatus_RUN_STATUS_INTERRUPTED}

	if err := ValidateRunResult(result); err == nil {
		t.Fatal("ValidateRunResult() expected error, got nil")
	}
}
