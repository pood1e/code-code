package triggerhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServerTriggersAction(t *testing.T) {
	server, err := NewServer(Config{Actions: map[string]ActionFunc{
		"sync": func(_ context.Context, request Request) (any, error) {
			var body struct {
				Value string `json:"value"`
			}
			if err := request.DecodeJSON(&body); err != nil {
				return nil, err
			}
			return map[string]string{"value": body.Value}, nil
		},
	}})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/internal/actions/sync", stringsReader(`{"value":"ok"}`))
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var response struct {
		Action string            `json:"action"`
		Status string            `json:"status"`
		Result map[string]string `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Action != "sync" || response.Status != "ok" || response.Result["value"] != "ok" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestServerRejectsUnknownAction(t *testing.T) {
	server, err := NewServer(Config{Actions: map[string]ActionFunc{
		"sync": func(context.Context, Request) (any, error) { return nil, nil },
	}})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/internal/actions/missing", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func stringsReader(value string) *strings.Reader {
	return strings.NewReader(value)
}
