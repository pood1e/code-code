package backgroundtasks

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

type Status string

const (
	StatusAccepted       Status = "accepted"
	StatusAlreadyRunning Status = "already_running"
)

type TaskFunc func(context.Context) error

type TaskConfig struct {
	Name    string
	Timeout time.Duration
}

type Registry struct {
	logger *slog.Logger
	mu     sync.RWMutex
	tasks  map[string]*task
}

type task struct {
	name    string
	timeout time.Duration
	logger  *slog.Logger
	mu      sync.Mutex
	running bool
}

func NewRegistry(logger *slog.Logger) *Registry {
	if logger == nil {
		logger = slog.Default()
	}
	return &Registry{
		logger: logger,
		tasks:  map[string]*task{},
	}
}

func (r *Registry) Register(config TaskConfig) error {
	if r == nil {
		return fmt.Errorf("backgroundtasks: registry is nil")
	}
	name := normalizeName(config.Name)
	if name == "" {
		return fmt.Errorf("backgroundtasks: task name is empty")
	}
	timeout := config.Timeout
	if timeout <= 0 {
		return fmt.Errorf("backgroundtasks: task %q timeout must be positive", name)
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tasks[name]; exists {
		return fmt.Errorf("backgroundtasks: task %q already registered", name)
	}
	r.tasks[name] = &task{
		name:    name,
		timeout: timeout,
		logger:  r.logger.With("background_task", name),
	}
	return nil
}

func (r *Registry) Trigger(name string, run TaskFunc) (Status, error) {
	if r == nil {
		return "", fmt.Errorf("backgroundtasks: registry is nil")
	}
	if run == nil {
		return "", fmt.Errorf("backgroundtasks: task function is nil")
	}
	task, ok := r.lookup(name)
	if !ok {
		return "", fmt.Errorf("backgroundtasks: task %q is not registered", normalizeName(name))
	}
	return task.trigger(run), nil
}

func (r *Registry) lookup(name string) (*task, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	task, ok := r.tasks[normalizeName(name)]
	return task, ok
}

func (t *task) trigger(run TaskFunc) Status {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return StatusAlreadyRunning
	}
	t.running = true
	t.mu.Unlock()

	go t.run(run)
	return StatusAccepted
}

func (t *task) run(run TaskFunc) {
	defer func() {
		if recovered := recover(); recovered != nil {
			t.logger.Error("background task panicked", "panic", recovered, "stack", string(debug.Stack()))
		}
		t.mu.Lock()
		t.running = false
		t.mu.Unlock()
	}()

	ctx, cancel := context.WithTimeout(context.Background(), t.timeout)
	defer cancel()
	startedAt := time.Now()
	t.logger.Info("background task started")
	if err := run(ctx); err != nil {
		t.logger.Error("background task failed", "duration", time.Since(startedAt).String(), "error", err)
		return
	}
	t.logger.Info("background task completed", "duration", time.Since(startedAt).String())
}

func normalizeName(name string) string {
	return strings.TrimSpace(name)
}
