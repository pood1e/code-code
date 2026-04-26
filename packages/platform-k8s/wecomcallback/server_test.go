package wecomcallback

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
)

type memoryPublisher struct {
	event *notificationv1.InboundMessageEvent
}

func (p *memoryPublisher) Publish(_ context.Context, event *notificationv1.InboundMessageEvent) error {
	p.event = event
	return nil
}

func TestServerHandlesVerifyURL(t *testing.T) {
	crypto, server := testServer(t)
	encrypted, signature, err := crypto.EncryptMessage("verified", "corp-id", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}
	request := httptest.NewRequest(http.MethodGet, "/wecom/callback?"+url.Values{
		"msg_signature": []string{signature},
		"timestamp":     []string{"12345"},
		"nonce":         []string{"nonce"},
		"echostr":       []string{encrypted},
	}.Encode(), nil)
	response := httptest.NewRecorder()

	server.handleCallback(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	if strings.TrimSpace(response.Body.String()) != "verified" {
		t.Fatalf("body = %q, want verified", response.Body.String())
	}
}

func TestServerHandlesEncryptedMessage(t *testing.T) {
	crypto, server := testServer(t)
	publisher := server.publisher.(*memoryPublisher)
	message := "<xml><Content><![CDATA[hi]]></Content><FromUserName><![CDATA[user]]></FromUserName></xml>"
	encrypted, signature, err := crypto.EncryptMessage(message, "corp-id", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}
	body := "<xml><Encrypt><![CDATA[" + encrypted + "]]></Encrypt></xml>"
	request := httptest.NewRequest(http.MethodPost, "/wecom/callback?"+url.Values{
		"msg_signature": []string{signature},
		"timestamp":     []string{"12345"},
		"nonce":         []string{"nonce"},
	}.Encode(), strings.NewReader(body))
	response := httptest.NewRecorder()

	server.handleCallback(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 body=%q", response.Code, response.Body.String())
	}
	if strings.TrimSpace(response.Body.String()) != "success" {
		t.Fatalf("body = %q, want success", response.Body.String())
	}
	wecom := publisher.event.GetWecom()
	if wecom.GetReceiveId() != "corp-id" {
		t.Fatalf("receive id = %q, want corp-id", wecom.GetReceiveId())
	}
	if wecom.GetMessageXml() != message {
		t.Fatalf("message xml = %q", wecom.GetMessageXml())
	}
	if got := wecom.GetMessage().GetFields()["Content"].GetStringValue(); got != "hi" {
		t.Fatalf("message Content = %q, want hi", got)
	}
}

func TestServerHandlesEncryptedJSONMessage(t *testing.T) {
	crypto, server := testServer(t)
	publisher := server.publisher.(*memoryPublisher)
	message := `{"msgid":"msg-1","msgtype":"text","text":{"content":"hi"}}`
	encrypted, signature, err := crypto.EncryptMessage(message, "", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}
	body := `{"encrypt": "` + encrypted + `"}`
	request := httptest.NewRequest(http.MethodPost, "/wecom/callback?"+url.Values{
		"msg_signature": []string{signature},
		"timestamp":     []string{"12345"},
		"nonce":         []string{"nonce"},
	}.Encode(), strings.NewReader(body))
	response := httptest.NewRecorder()

	server.handleCallback(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 body=%q", response.Code, response.Body.String())
	}
	if strings.TrimSpace(response.Body.String()) != "success" {
		t.Fatalf("body = %q, want success", response.Body.String())
	}
	wecom := publisher.event.GetWecom()
	if wecom.GetReceiveId() != "" {
		t.Fatalf("receive id = %q, want empty", wecom.GetReceiveId())
	}
	if wecom.GetMessageXml() != message {
		t.Fatalf("message = %q", wecom.GetMessageXml())
	}
	if got := wecom.GetMessage().GetFields()["msgtype"].GetStringValue(); got != "text" {
		t.Fatalf("message msgtype = %q, want text", got)
	}
}

func testServer(t *testing.T) (*Crypto, *Server) {
	t.Helper()
	publisher := &memoryPublisher{}
	server, err := NewServer(Config{
		Token:          "token",
		EncodingAESKey: testEncodingAESKey,
	}, publisher, nil)
	if err != nil {
		t.Fatalf("NewServer() error = %v", err)
	}
	return server.crypto, server
}
