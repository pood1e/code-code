package notificationdispatcher

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
)

func TestDeliverPostsApprisePayload(t *testing.T) {
	var got apprisePayload
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Fatalf("content-type = %q, want application/json", r.Header.Get("Content-Type"))
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	dispatcher, err := New(Config{
		NATSURL:    "nats://example.invalid:4222",
		AppriseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	request := &notificationv1.NotificationRequest{
		EventId: "notification-1",
		Title:   "Build finished",
		Body:    "CLI image is ready.",
		Type:    notificationv1.NotificationType_NOTIFICATION_TYPE_SUCCESS,
		Format:  notificationv1.NotificationFormat_NOTIFICATION_FORMAT_TEXT,
	}
	if err := dispatcher.deliver(context.Background(), request); err != nil {
		t.Fatalf("deliver() error = %v", err)
	}
	want := apprisePayload{
		Title:  "Build finished",
		Body:   "CLI image is ready.",
		Type:   "success",
		Format: "text",
	}
	if got != want {
		t.Fatalf("payload = %+v, want %+v", got, want)
	}
}

func TestDeliverReturnsStatusError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	dispatcher, err := New(Config{
		NATSURL:    "nats://example.invalid:4222",
		AppriseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	err = dispatcher.deliver(context.Background(), &notificationv1.NotificationRequest{
		EventId: "notification-1",
		Body:    "retry me",
	})
	if err == nil {
		t.Fatal("deliver() error = nil, want status error")
	}
}

func TestDefaultApprisePayloadValues(t *testing.T) {
	payload := toApprisePayload(&notificationv1.NotificationRequest{
		EventId: "notification-1",
		Body:    "default me",
	})
	want := apprisePayload{
		Title:  "Code Code notification",
		Body:   "default me",
		Type:   "info",
		Format: "markdown",
	}
	if payload != want {
		t.Fatalf("payload = %+v, want %+v", payload, want)
	}
}

func TestValidateRequestRequiresEventIDAndBody(t *testing.T) {
	if err := validateRequest(&notificationv1.NotificationRequest{Body: "body"}); err == nil {
		t.Fatal("validateRequest() error = nil without event_id")
	}
	if err := validateRequest(&notificationv1.NotificationRequest{EventId: "notification-1"}); err == nil {
		t.Fatal("validateRequest() error = nil without body")
	}
}
