package notificationdispatcher

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultStreamName is the JetStream stream that stores notification requests.
	DefaultStreamName = "PLATFORM_NOTIFICATIONS"
	// DefaultSubject is the platform notification request subject.
	DefaultSubject = "platform.notifications.requested"
	// DefaultConsumerName is the durable consumer used by the dispatcher.
	DefaultConsumerName = "platform-notification-dispatcher"
	// DefaultAppriseURL is the in-cluster Apprise API notification endpoint.
	DefaultAppriseURL = "http://apprise-api.code-code.svc.cluster.local:8000/notify/"
)

const (
	defaultClientName  = "notification-dispatcher"
	defaultHTTPTimeout = 10 * time.Second
	defaultRetryDelay  = 30 * time.Second
)

// Config groups notification dispatcher runtime dependencies and endpoints.
type Config struct {
	NATSURL      string
	StreamName   string
	Subject      string
	ConsumerName string
	ClientName   string
	AppriseURL   string
	HTTPClient   *http.Client
	HTTPTimeout  time.Duration
	RetryDelay   time.Duration
	Logger       *slog.Logger
}

// Dispatcher consumes notification requests and delivers them through Apprise API.
type Dispatcher struct {
	config Config
}

// New validates configuration and creates a dispatcher.
func New(config Config) (*Dispatcher, error) {
	normalized, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	return &Dispatcher{config: normalized}, nil
}

func normalizeConfig(config Config) (Config, error) {
	config.NATSURL = strings.TrimSpace(config.NATSURL)
	if config.NATSURL == "" {
		return Config{}, fmt.Errorf("notificationdispatcher: nats url is required")
	}
	config.StreamName = defaultString(config.StreamName, DefaultStreamName)
	config.Subject = defaultString(config.Subject, DefaultSubject)
	config.ConsumerName = defaultString(config.ConsumerName, DefaultConsumerName)
	config.ClientName = defaultString(config.ClientName, defaultClientName)
	config.AppriseURL = defaultString(config.AppriseURL, DefaultAppriseURL)
	if config.HTTPTimeout <= 0 {
		config.HTTPTimeout = defaultHTTPTimeout
	}
	if config.RetryDelay <= 0 {
		config.RetryDelay = defaultRetryDelay
	}
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: config.HTTPTimeout}
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	return config, nil
}

func defaultString(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
