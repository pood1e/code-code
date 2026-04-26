package egresspolicies

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

func normalizeHostname(value string) string {
	host := strings.ToLower(strings.TrimSpace(value))
	host = strings.TrimSuffix(host, ".")
	if strings.Contains(host, "://") {
		parsed, err := url.Parse(host)
		if err == nil {
			host = parsed.Hostname()
		}
	}
	if strings.Contains(host, ":") && !strings.Contains(host, "]") {
		withoutPort, _, err := net.SplitHostPort(host)
		if err == nil {
			host = withoutPort
		}
	}
	return strings.Trim(host, " /")
}

func validHostname(host string) bool {
	if host == "" || len(host) > 253 || strings.Contains(host, "_") {
		return false
	}
	labels := strings.Split(host, ".")
	for _, label := range labels {
		if label == "" || len(label) > 63 {
			return false
		}
		if strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return false
		}
		for _, r := range label {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
				continue
			}
			return false
		}
	}
	return true
}

func parseExactHostname(value string) (string, error) {
	host := normalizeHostname(value)
	if host == "" || strings.HasPrefix(host, "*.") || strings.Contains(host, "*") || net.ParseIP(host) != nil {
		return "", fmt.Errorf("target host %q must be an exact DNS hostname", value)
	}
	if !validHostname(host) {
		return "", fmt.Errorf("target host %q is invalid", value)
	}
	return host, nil
}

func parseSuffixHostname(value string) (string, error) {
	host := normalizeHostname(value)
	host = strings.TrimPrefix(host, "*.")
	host = strings.TrimPrefix(host, ".")
	if host == "" || strings.Contains(host, "*") || net.ParseIP(host) != nil {
		return "", fmt.Errorf("target host suffix %q is invalid", value)
	}
	if !validHostname(host) {
		return "", fmt.Errorf("target host suffix %q is invalid", value)
	}
	return host, nil
}

func wildcardHostForSuffix(suffix string) string {
	return "*." + suffix
}
