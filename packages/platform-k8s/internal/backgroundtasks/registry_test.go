package backgroundtasks

import (
	"context"
	"log/slog"
	"testing"
	"time"
)

func TestRegistryTriggerRunsTask(t *testing.T) {
	registry := NewRegistry(slog.Default())
	if err := registry.Register(TaskConfig{Name: "sync", Timeout: time.Second}); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})

	status, err := registry.Trigger("sync", func(context.Context) error {
		close(done)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusAccepted {
		t.Fatalf("Trigger() status = %q, want %q", status, StatusAccepted)
	}

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("background task did not run")
	}
}

func TestRegistryTriggerRejectsConcurrentRun(t *testing.T) {
	registry := NewRegistry(slog.Default())
	if err := registry.Register(TaskConfig{Name: "sync", Timeout: time.Second}); err != nil {
		t.Fatal(err)
	}
	release := make(chan struct{})
	started := make(chan struct{})
	firstStatus, err := registry.Trigger("sync", func(context.Context) error {
		close(started)
		<-release
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if firstStatus != StatusAccepted {
		t.Fatalf("first Trigger() status = %q, want %q", firstStatus, StatusAccepted)
	}
	<-started

	secondStatus, err := registry.Trigger("sync", func(context.Context) error {
		t.Fatal("second task should not run")
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if secondStatus != StatusAlreadyRunning {
		t.Fatalf("second Trigger() status = %q, want %q", secondStatus, StatusAlreadyRunning)
	}
	close(release)
}

func TestRegistryRejectsDuplicateRegistration(t *testing.T) {
	registry := NewRegistry(slog.Default())
	if err := registry.Register(TaskConfig{Name: "sync", Timeout: time.Second}); err != nil {
		t.Fatal(err)
	}
	if err := registry.Register(TaskConfig{Name: "sync", Timeout: time.Second}); err == nil {
		t.Fatal("Register() error = nil, want duplicate error")
	}
}
