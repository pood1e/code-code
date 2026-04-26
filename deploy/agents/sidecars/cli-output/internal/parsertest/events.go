package parsertest

import outputv1 "code-code.internal/go-contract/agent/output/v1"

func EventType(output *outputv1.RunOutput) string {
	return EventString(output, "type")
}

func EventString(output *outputv1.RunOutput, key string) string {
	if output == nil || output.GetEvent() == nil {
		return ""
	}
	value := output.GetEvent().GetFields()[key]
	if value == nil {
		return ""
	}
	return value.GetStringValue()
}

func CustomValue(output *outputv1.RunOutput) map[string]any {
	if output == nil || output.GetEvent() == nil {
		return nil
	}
	value := output.GetEvent().GetFields()["value"]
	if value == nil {
		return nil
	}
	payload, _ := value.AsInterface().(map[string]any)
	return payload
}
