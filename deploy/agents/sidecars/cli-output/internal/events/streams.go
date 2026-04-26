package events

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

const (
	deltaStreamName  = "RUN_DELTA"
	resultStreamName = "RUN_RESULT"
	statusStreamName = "RUN_STATUS"
	defaultMaxAge    = 24 * time.Hour
)

func ensureStreams(ctx context.Context, js jetstream.JetStream) error {
	for _, config := range []jetstream.StreamConfig{
		{Name: deltaStreamName, Subjects: []string{"platform.run.delta.>"}, Retention: jetstream.LimitsPolicy, MaxAge: defaultMaxAge, Storage: jetstream.MemoryStorage, Replicas: 1},
		{Name: resultStreamName, Subjects: []string{"platform.run.result.>"}, Retention: jetstream.LimitsPolicy, MaxAge: defaultMaxAge, Storage: jetstream.FileStorage, Replicas: 1},
		{Name: statusStreamName, Subjects: []string{"platform.run.status.>"}, Retention: jetstream.LimitsPolicy, MaxAge: defaultMaxAge, Storage: jetstream.FileStorage, Replicas: 1},
	} {
		if _, err := js.CreateOrUpdateStream(ctx, config); err != nil {
			return fmt.Errorf("cli-output-sidecar/events: ensure stream %q: %w", config.Name, err)
		}
	}
	return nil
}

func deltaSubject(sessionID, runID string) string {
	return fmt.Sprintf("platform.run.delta.%s.%s", subjectToken(sessionID), subjectToken(runID))
}

func resultSubject(sessionID, runID string) string {
	return fmt.Sprintf("platform.run.result.%s.%s", subjectToken(sessionID), subjectToken(runID))
}

func statusSubject(sessionID, runID string) string {
	return fmt.Sprintf("platform.run.status.%s.%s", subjectToken(sessionID), subjectToken(runID))
}

func subjectToken(value string) string {
	normalized := strings.TrimSpace(value)
	normalized = strings.ReplaceAll(normalized, ".", "_")
	normalized = strings.ReplaceAll(normalized, "*", "_")
	normalized = strings.ReplaceAll(normalized, ">", "_")
	if normalized == "" {
		return "_"
	}
	return normalized
}
