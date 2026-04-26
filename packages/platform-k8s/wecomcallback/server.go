package wecomcallback

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	notificationv1 "code-code.internal/go-contract/platform/notification/v1"
)

const maxCallbackBodyBytes = 1 << 20

// Config defines the WeCom callback adapter runtime settings.
type Config struct {
	Addr           string
	Path           string
	Token          string
	EncodingAESKey string
}

// EventPublisher publishes decrypted callback messages.
type EventPublisher interface {
	Publish(ctx context.Context, event *notificationv1.InboundMessageEvent) error
}

// Server handles Enterprise WeChat callback verification and messages.
type Server struct {
	config    Config
	crypto    *Crypto
	publisher EventPublisher
	logger    *slog.Logger
}

// NewServer creates one callback HTTP server.
func NewServer(config Config, publisher EventPublisher, logger *slog.Logger) (*Server, error) {
	if config.Addr == "" {
		config.Addr = ":8080"
	}
	if config.Path == "" {
		config.Path = "/wecom/callback"
	}
	if publisher == nil {
		return nil, fmt.Errorf("wecomcallback: publisher is nil")
	}
	if logger == nil {
		logger = slog.Default()
	}
	crypto, err := NewCrypto(config.Token, config.EncodingAESKey)
	if err != nil {
		return nil, err
	}
	return &Server{config: config, crypto: crypto, publisher: publisher, logger: logger}, nil
}

// ListenAndServe starts the callback HTTP server.
func (s *Server) ListenAndServe() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc(s.config.Path, s.handleCallback)
	server := &http.Server{
		Addr:              s.config.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	return server.ListenAndServe()
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleVerifyURL(w, r)
	case http.MethodPost:
		s.handleMessage(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleVerifyURL(w http.ResponseWriter, r *http.Request) {
	params := signatureFromRequest(r)
	reply, err := params.verifyURL(s.crypto, r.URL.Query().Get("echostr"))
	if err != nil {
		s.logger.Warn("reject wecom url verification", "error", err)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(reply))
}

func (s *Server) handleMessage(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCallbackBodyBytes))
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	encrypted, err := encryptedMessage(body)
	if err != nil {
		s.logger.Warn("reject malformed wecom callback", "error", err)
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	params := signatureFromRequest(r)
	plain, receiveID, err := params.decryptMessage(s.crypto, encrypted)
	if err != nil {
		s.logger.Warn("reject unverifiable wecom callback", "error", err)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	event := newInboundMessageEvent(params, decryptedMessage{
		raw:       plain,
		receiveID: receiveID,
	}, time.Now().UTC())
	if err := s.publisher.Publish(r.Context(), event); err != nil {
		s.logger.Error("publish wecom callback failed", "error", err)
		http.Error(w, "publish failed", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("success"))
}
