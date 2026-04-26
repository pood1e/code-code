package wecomcallback

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strings"
)

type encryptedJSONEnvelope struct {
	Encrypt string `json:"encrypt"`
}

type encryptedXMLEnvelope struct {
	Encrypt string `xml:"Encrypt"`
}

func encryptedMessage(body []byte) (string, error) {
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return "", fmt.Errorf("wecomcallback: empty callback body")
	}
	if bytes.HasPrefix(body, []byte("{")) {
		return encryptedJSONMessage(body)
	}
	return encryptedXMLMessage(body)
}

func encryptedJSONMessage(body []byte) (string, error) {
	var envelope encryptedJSONEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", fmt.Errorf("wecomcallback: decode json envelope: %w", err)
	}
	if strings.TrimSpace(envelope.Encrypt) == "" {
		return "", fmt.Errorf("wecomcallback: missing json encrypt")
	}
	return envelope.Encrypt, nil
}

func encryptedXMLMessage(body []byte) (string, error) {
	var envelope encryptedXMLEnvelope
	if err := xml.Unmarshal(body, &envelope); err != nil {
		return "", fmt.Errorf("wecomcallback: decode xml envelope: %w", err)
	}
	if strings.TrimSpace(envelope.Encrypt) == "" {
		return "", fmt.Errorf("wecomcallback: missing xml Encrypt")
	}
	return envelope.Encrypt, nil
}
