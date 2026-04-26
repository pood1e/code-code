package outputv1

import "fmt"

const maxSafeJSInteger uint64 = 9007199254740991

// ValidateRunOutput validates one ordered AG-UI run output event.
func ValidateRunOutput(output *RunOutput) error {
	if output == nil {
		return fmt.Errorf("outputv1: run output is nil")
	}
	if output.Sequence > maxSafeJSInteger {
		return fmt.Errorf("outputv1: run output sequence %d exceeds max safe JS integer", output.Sequence)
	}
	if output.Timestamp != nil && !output.Timestamp.IsValid() {
		return fmt.Errorf("outputv1: run output timestamp is invalid")
	}
	if output.Event == nil {
		return fmt.Errorf("outputv1: run output event is empty")
	}
	if output.Event.Fields["type"] == nil || output.Event.Fields["type"].GetStringValue() == "" {
		return fmt.Errorf("outputv1: run output event.type is empty")
	}
	return nil
}

// ValidateRunOutputSequence validates that one ordered output slice is strictly increasing.
func ValidateRunOutputSequence(outputs []*RunOutput) error {
	var prev uint64
	for i, output := range outputs {
		if err := ValidateRunOutput(output); err != nil {
			return err
		}
		if i > 0 && output.Sequence <= prev {
			return fmt.Errorf("outputv1: run output sequence %d is not greater than previous sequence %d", output.Sequence, prev)
		}
		prev = output.Sequence
	}
	return nil
}
