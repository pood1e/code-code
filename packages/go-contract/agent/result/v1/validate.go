package resultv1

import "fmt"

// ValidateRunError validates one structured run error.
func ValidateRunError(runError *RunError) error {
	if runError == nil {
		return fmt.Errorf("resultv1: run error is nil")
	}
	if runError.Code == "" {
		return fmt.Errorf("resultv1: run error code is empty")
	}
	if runError.Message == "" {
		return fmt.Errorf("resultv1: run error message is empty")
	}
	return nil
}

// ValidateRunResult validates one final run result.
func ValidateRunResult(result *RunResult) error {
	if result == nil {
		return fmt.Errorf("resultv1: run result is nil")
	}
	switch result.Status {
	case RunStatus_RUN_STATUS_COMPLETED:
		if result.Error != nil {
			return fmt.Errorf("resultv1: completed run result must not include error")
		}
	case RunStatus_RUN_STATUS_FAILED:
		if err := ValidateRunError(result.Error); err != nil {
			return fmt.Errorf("resultv1: failed run result requires valid error: %w", err)
		}
		if result.ResumeToken != "" {
			return fmt.Errorf("resultv1: failed run result must not include resume token")
		}
	case RunStatus_RUN_STATUS_CANCELLED:
		if result.Error != nil {
			if err := ValidateRunError(result.Error); err != nil {
				return fmt.Errorf("resultv1: cancelled run result has invalid error: %w", err)
			}
		}
		if result.ResumeToken != "" {
			return fmt.Errorf("resultv1: cancelled run result must not include resume token")
		}
	case RunStatus_RUN_STATUS_INTERRUPTED:
		if result.ResumeToken == "" {
			return fmt.Errorf("resultv1: interrupted run result requires resume token")
		}
		if result.Error != nil {
			if err := ValidateRunError(result.Error); err != nil {
				return fmt.Errorf("resultv1: interrupted run result has invalid error: %w", err)
			}
		}
	default:
		return fmt.Errorf("resultv1: run result status is unspecified")
	}
	return nil
}
