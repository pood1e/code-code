package qwen

import (
	"strings"
)

const (
	openThinkTag  = "<think>"
	closeThinkTag = "</think>"
)

type inlineThinkingStream struct {
	inThink             bool
	pending             string
	trimAssistantPrefix bool
}

func (s *inlineThinkingStream) Append(text string) (string, string) {
	data := s.pending + text
	s.pending = ""
	if data == "" {
		return "", ""
	}
	var reasoning strings.Builder
	var assistant strings.Builder
	cursor := 0
	for cursor < len(data) {
		if s.inThink {
			if index := strings.Index(data[cursor:], closeThinkTag); index >= 0 {
				reasoning.WriteString(data[cursor : cursor+index])
				s.inThink = false
				s.trimAssistantPrefix = true
				cursor += index + len(closeThinkTag)
				continue
			}
			emitEnd := len(data) - trailingTagPrefixLen(data[cursor:], closeThinkTag)
			s.pending = data[emitEnd:]
			reasoning.WriteString(data[cursor:emitEnd])
			break
		}
		if index := strings.Index(data[cursor:], openThinkTag); index >= 0 {
			appendAssistantText(&assistant, data[cursor:cursor+index], &s.trimAssistantPrefix)
			s.inThink = true
			cursor += index + len(openThinkTag)
			continue
		}
		emitEnd := len(data) - trailingTagPrefixLen(data[cursor:], openThinkTag)
		s.pending = data[emitEnd:]
		appendAssistantText(&assistant, data[cursor:emitEnd], &s.trimAssistantPrefix)
		break
	}
	return reasoning.String(), assistant.String()
}

func splitInlineThinking(text string) (string, string) {
	stream := &inlineThinkingStream{}
	reasoning, assistant := stream.Append(text)
	if stream.pending == "" {
		return reasoning, assistant
	}
	if stream.inThink {
		return reasoning + stream.pending, assistant
	}
	var tail strings.Builder
	appendAssistantText(&tail, stream.pending, &stream.trimAssistantPrefix)
	return reasoning, assistant + tail.String()
}

func trailingTagPrefixLen(text, tag string) int {
	limit := len(tag) - 1
	if limit > len(text) {
		limit = len(text)
	}
	for size := limit; size > 0; size-- {
		if strings.HasSuffix(text, tag[:size]) {
			return size
		}
	}
	return 0
}

func appendAssistantText(builder *strings.Builder, text string, trimPrefix *bool) {
	if builder == nil || text == "" {
		return
	}
	if trimPrefix != nil && *trimPrefix {
		text = strings.TrimLeft(text, " \t\r\n")
		if text == "" {
			return
		}
		*trimPrefix = false
	}
	builder.WriteString(text)
}
