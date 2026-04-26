package egresspolicies

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	externalRuleSetMaxBytes = 5 << 20
	externalRuleSetMaxHosts = 10000
)

type externalRuleSetLoader interface {
	Load(context.Context, string, string) (externalRuleSetLoad, error)
}

type externalRuleSetLoad struct {
	hosts        []string
	skippedRules int32
	loadedAt     *timestamppb.Timestamp
}

type httpExternalRuleSetLoader struct {
	client *http.Client
}

func newExternalRuleSetLoader() externalRuleSetLoader {
	return &httpExternalRuleSetLoader{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (l *httpExternalRuleSetLoader) Load(ctx context.Context, sourceURL string, proxyURL string) (externalRuleSetLoad, error) {
	parsed, err := validateExternalRuleSetURL(ctx, sourceURL)
	if err != nil {
		return externalRuleSetLoad{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return externalRuleSetLoad{}, fmt.Errorf("build AutoProxy request: %w", err)
	}
	client, err := l.clientForProxy(proxyURL)
	if err != nil {
		return externalRuleSetLoad{}, err
	}
	response, err := client.Do(request)
	if err != nil {
		return externalRuleSetLoad{}, fmt.Errorf("load AutoProxy rule set: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return externalRuleSetLoad{}, fmt.Errorf("load AutoProxy rule set: unexpected HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, externalRuleSetMaxBytes+1))
	if err != nil {
		return externalRuleSetLoad{}, fmt.Errorf("read AutoProxy rule set: %w", err)
	}
	if len(body) > externalRuleSetMaxBytes {
		return externalRuleSetLoad{}, fmt.Errorf("AutoProxy rule set exceeds %d bytes", externalRuleSetMaxBytes)
	}
	hosts, skipped, err := parseAutoProxyHosts(body)
	if err != nil {
		return externalRuleSetLoad{}, err
	}
	return externalRuleSetLoad{
		hosts:        hosts,
		skippedRules: skipped,
		loadedAt:     timestamppb.Now(),
	}, nil
}

func (l *httpExternalRuleSetLoader) clientForProxy(proxyURL string) (*http.Client, error) {
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL == "" {
		return l.client, nil
	}
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("parse AutoProxy fetch proxy URL: %w", err)
	}
	if parsed.Scheme != "http" || parsed.Hostname() == "" {
		return nil, fmt.Errorf("AutoProxy fetch proxy URL must be an HTTP proxy URL")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = http.ProxyURL(parsed)
	return &http.Client{
		Timeout:   l.client.Timeout,
		Transport: transport,
	}, nil
}

func validateExternalRuleSetURL(ctx context.Context, sourceURL string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(sourceURL))
	if err != nil {
		return nil, fmt.Errorf("parse AutoProxy URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("AutoProxy URL must use http or https")
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("AutoProxy URL must not include credentials")
	}
	hostname := strings.TrimSpace(parsed.Hostname())
	if hostname == "" {
		return nil, fmt.Errorf("AutoProxy URL host is required")
	}
	if err := rejectPrivateRuleSetHost(ctx, hostname); err != nil {
		return nil, err
	}
	return parsed, nil
}

func rejectPrivateRuleSetHost(ctx context.Context, hostname string) error {
	host := strings.ToLower(strings.TrimSuffix(hostname, "."))
	switch {
	case host == "localhost",
		strings.HasSuffix(host, ".localhost"),
		strings.HasSuffix(host, ".local"),
		strings.HasSuffix(host, ".svc"),
		strings.HasSuffix(host, ".cluster.local"):
		return fmt.Errorf("AutoProxy URL host %q is not allowed", hostname)
	}
	if ip := net.ParseIP(host); ip != nil {
		if !publicIP(ip) {
			return fmt.Errorf("AutoProxy URL host %q resolves to a private address", hostname)
		}
		return nil
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("resolve AutoProxy URL host %q: %w", hostname, err)
	}
	if len(ips) == 0 {
		return fmt.Errorf("resolve AutoProxy URL host %q: no addresses", hostname)
	}
	for _, item := range ips {
		if !publicIP(item.IP) {
			return fmt.Errorf("AutoProxy URL host %q resolves to a private address", hostname)
		}
	}
	return nil
}

func publicIP(ip net.IP) bool {
	return ip != nil &&
		!ip.IsUnspecified() &&
		!ip.IsLoopback() &&
		!ip.IsPrivate() &&
		!ip.IsLinkLocalUnicast() &&
		!ip.IsLinkLocalMulticast() &&
		!ip.IsMulticast()
}

func parseAutoProxyHosts(payload []byte) ([]string, int32, error) {
	content := decodeAutoProxyPayload(payload)
	scanner := bufio.NewScanner(strings.NewReader(content))
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	seen := map[string]struct{}{}
	hosts := make([]string, 0)
	var skipped int32
	for scanner.Scan() {
		line := scanner.Text()
		if ignoredAutoProxyLine(line) {
			continue
		}
		host, ok := autoProxyLineHost(line)
		if !ok {
			skipped++
			continue
		}
		target, err := newTarget(host)
		if err != nil {
			skipped++
			continue
		}
		if _, exists := seen[target.hostname]; exists {
			continue
		}
		seen[target.hostname] = struct{}{}
		hosts = append(hosts, target.hostname)
		if len(hosts) > externalRuleSetMaxHosts {
			return nil, skipped, fmt.Errorf("AutoProxy rule set exceeds %d supported hosts", externalRuleSetMaxHosts)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, skipped, fmt.Errorf("scan AutoProxy rule set: %w", err)
	}
	sort.Strings(hosts)
	return hosts, skipped, nil
}

func decodeAutoProxyPayload(payload []byte) string {
	raw := strings.TrimSpace(string(payload))
	compact := strings.NewReplacer("\n", "", "\r", "", "\t", "", " ", "").Replace(raw)
	decoded, err := base64.StdEncoding.DecodeString(compact)
	if err != nil {
		return raw
	}
	text := strings.TrimSpace(string(decoded))
	if strings.Contains(text, "||") || strings.Contains(text, "[AutoProxy") {
		return text
	}
	return raw
}

func autoProxyLineHost(line string) (string, bool) {
	value := strings.TrimSpace(line)
	if value == "" || strings.HasPrefix(value, "@@") {
		return "", false
	}
	if cut := strings.Index(value, "$"); cut >= 0 {
		value = value[:cut]
	}
	if strings.HasPrefix(value, "||") {
		return hostBeforeAutoProxyDelimiter(value[2:])
	}
	if strings.HasPrefix(value, "|") {
		value = strings.TrimLeft(value, "|")
	}
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Hostname() == "" {
			return "", false
		}
		return parsed.Hostname(), true
	}
	if strings.HasPrefix(value, "/") || strings.ContainsAny(value, "*/") {
		return "", false
	}
	return hostBeforeAutoProxyDelimiter(strings.TrimPrefix(value, "."))
}

func ignoredAutoProxyLine(line string) bool {
	value := strings.TrimSpace(line)
	return value == "" || strings.HasPrefix(value, "!") || strings.HasPrefix(value, "[")
}

func hostBeforeAutoProxyDelimiter(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", false
	}
	end := len(value)
	for _, delimiter := range []string{"^", "/", "*", "|"} {
		if index := strings.Index(value, delimiter); index >= 0 && index < end {
			end = index
		}
	}
	host := normalizeHostname(value[:end])
	if host == "" {
		return "", false
	}
	return host, true
}
