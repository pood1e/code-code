package notificationdispatcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
)

const maxErrorBodyBytes = 2048

type apprisePayload struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	Type   string `json:"type"`
	Format string `json:"format"`
}

func validateRequest(request *notificationv1.NotificationRequest) error {
	if request == nil {
		return fmt.Errorf("notification request is nil")
	}
	if strings.TrimSpace(request.GetEventId()) == "" {
		return fmt.Errorf("notification event_id is required")
	}
	if strings.TrimSpace(request.GetBody()) == "" {
		return fmt.Errorf("notification body is required")
	}
	return nil
}

func (d *Dispatcher) deliver(ctx context.Context, request *notificationv1.NotificationRequest) error {
	payload, err := json.Marshal(toApprisePayload(request))
	if err != nil {
		return fmt.Errorf("encode apprise payload: %w", err)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, d.config.AppriseURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build apprise request: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	httpRequest.Header.Set("Accept", "application/json")

	response, err := d.config.HTTPClient.Do(httpRequest)
	if err != nil {
		return fmt.Errorf("post apprise notification: %w", err)
	}
	defer response.Body.Close()
	if appriseStatusAllowed(response.StatusCode) {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(response.Body, maxErrorBodyBytes))
	return fmt.Errorf("apprise notification status=%d body=%q", response.StatusCode, string(body))
}

func toApprisePayload(request *notificationv1.NotificationRequest) apprisePayload {
	title := strings.TrimSpace(request.GetTitle())
	if title == "" {
		title = "Code Code notification"
	}
	return apprisePayload{
		Title:  title,
		Body:   request.GetBody(),
		Type:   notificationType(request.GetType()),
		Format: notificationFormat(request.GetFormat()),
	}
}

func notificationType(value notificationv1.NotificationType) string {
	switch value {
	case notificationv1.NotificationType_NOTIFICATION_TYPE_SUCCESS:
		return "success"
	case notificationv1.NotificationType_NOTIFICATION_TYPE_WARNING:
		return "warning"
	case notificationv1.NotificationType_NOTIFICATION_TYPE_FAILURE:
		return "failure"
	default:
		return "info"
	}
}

func notificationFormat(value notificationv1.NotificationFormat) string {
	switch value {
	case notificationv1.NotificationFormat_NOTIFICATION_FORMAT_TEXT:
		return "text"
	case notificationv1.NotificationFormat_NOTIFICATION_FORMAT_HTML:
		return "html"
	default:
		return "markdown"
	}
}

func appriseStatusAllowed(status int) bool {
	return status == http.StatusOK || status == http.StatusCreated || status == http.StatusNoContent
}
