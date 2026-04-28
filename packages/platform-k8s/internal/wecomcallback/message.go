package wecomcallback

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"strings"
	"time"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type decryptedMessage struct {
	raw       string
	receiveID string
}

func newInboundMessageEvent(params callbackSignature, message decryptedMessage, receivedAt time.Time) *notificationv1.InboundMessageEvent {
	return &notificationv1.InboundMessageEvent{
		Provider:   "wecom",
		ReceivedAt: timestamppb.New(receivedAt),
		Payload: &notificationv1.InboundMessageEvent_Wecom{
			Wecom: &notificationv1.WeComInboundMessage{
				Timestamp:  params.timestamp,
				Nonce:      params.nonce,
				ReceiveId:  message.receiveID,
				MessageXml: message.raw,
				Message:    compactMessageFields(message.raw),
			},
		},
	}
}

func compactMessageFields(message string) *structpb.Struct {
	var jsonFields map[string]any
	if err := json.Unmarshal([]byte(message), &jsonFields); err == nil {
		value, err := structpb.NewStruct(jsonFields)
		if err == nil {
			return value
		}
	}
	return compactXMLFields(message)
}

func compactXMLFields(messageXML string) *structpb.Struct {
	fields := map[string]any{}
	decoder := xml.NewDecoder(bytes.NewReader([]byte(messageXML)))
	var current string
	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch value := token.(type) {
		case xml.StartElement:
			current = value.Name.Local
		case xml.CharData:
			text := strings.TrimSpace(string(value))
			if current != "" && text != "" {
				fields[current] = text
			}
		case xml.EndElement:
			current = ""
		}
	}
	if len(fields) == 0 {
		return nil
	}
	value, err := structpb.NewStruct(fields)
	if err != nil {
		return nil
	}
	return value
}
