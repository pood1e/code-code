package modelservice

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"code-code.internal/platform-k8s/internal/backgroundtasks"
)

const (
	modelTaskDefinitionSync = "model-definition-sync"

	modelBackgroundTaskTimeout = 3 * time.Minute
)

func newBackgroundTaskRegistry(logger *slog.Logger) (*backgroundtasks.Registry, error) {
	registry := backgroundtasks.NewRegistry(logger)
	if err := registry.Register(backgroundtasks.TaskConfig{Name: modelTaskDefinitionSync, Timeout: modelBackgroundTaskTimeout}); err != nil {
		return nil, err
	}
	return registry, nil
}

func (s *Server) triggerBackgroundTask(name string, run backgroundtasks.TaskFunc) (string, error) {
	if s == nil || s.backgroundTasks == nil {
		return "", fmt.Errorf("platformk8s/modelservice: background task registry is not initialized")
	}
	status, err := s.backgroundTasks.Trigger(name, run)
	if err != nil {
		return "", err
	}
	return string(status), nil
}

func (s *Server) runModelDefinitionSync(ctx context.Context) error {
	if s == nil || s.syncer == nil {
		return fmt.Errorf("platformk8s/modelservice: model definition syncer is not initialized")
	}
	return s.syncer.SyncNow(ctx)
}
