package authservice

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"code-code.internal/platform-k8s/internal/backgroundtasks"
)

const (
	authTaskOAuthRefreshDue  = "oauth-refresh-due"
	authTaskOAuthSessionScan = "oauth-session-scan"

	authBackgroundTaskTimeout = 2 * time.Minute
)

func newBackgroundTaskRegistry(logger *slog.Logger) (*backgroundtasks.Registry, error) {
	registry := backgroundtasks.NewRegistry(logger)
	for _, name := range []string{
		authTaskOAuthRefreshDue,
		authTaskOAuthSessionScan,
	} {
		if err := registry.Register(backgroundtasks.TaskConfig{Name: name, Timeout: authBackgroundTaskTimeout}); err != nil {
			return nil, err
		}
	}
	return registry, nil
}

func (s *Server) triggerBackgroundTask(name string, run backgroundtasks.TaskFunc) (string, error) {
	if s == nil || s.backgroundTasks == nil {
		return "", fmt.Errorf("platformk8s/authservice: background task registry is not initialized")
	}
	status, err := s.backgroundTasks.Trigger(name, run)
	if err != nil {
		return "", err
	}
	return string(status), nil
}

func (s *Server) runOAuthRefreshDue(ctx context.Context) error {
	if s == nil || s.refreshRunner == nil {
		return fmt.Errorf("platformk8s/authservice: oauth refresh runner is not initialized")
	}
	return s.refreshRunner.RunAll(ctx)
}

func (s *Server) runOAuthSessionScan(ctx context.Context) error {
	if s == nil || s.oauthSessions == nil {
		return errOAuthSessionUnavailable()
	}
	return s.oauthSessions.ScanSessions(ctx)
}
