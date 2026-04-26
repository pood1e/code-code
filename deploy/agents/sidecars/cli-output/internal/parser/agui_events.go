package parser

import (
	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
)

type textChannel int

const (
	textChannelAssistant textChannel = iota
	textChannelReasoning
)

func startTextEvent(channel textChannel, messageID, role string) aguievents.Event {
	if channel == textChannelReasoning {
		return aguievents.NewReasoningMessageStartEvent(messageID, role)
	}
	return aguievents.NewTextMessageStartEvent(messageID, aguievents.WithRole(role))
}

func contentTextEvent(channel textChannel, messageID, delta string) aguievents.Event {
	if channel == textChannelReasoning {
		return aguievents.NewReasoningMessageContentEvent(messageID, delta)
	}
	return aguievents.NewTextMessageContentEvent(messageID, delta)
}

func endTextEvent(channel textChannel, messageID string) aguievents.Event {
	if channel == textChannelReasoning {
		return aguievents.NewReasoningMessageEndEvent(messageID)
	}
	return aguievents.NewTextMessageEndEvent(messageID)
}
