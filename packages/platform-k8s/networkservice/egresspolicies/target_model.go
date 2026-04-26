package egresspolicies

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

type egressTarget struct {
	hostname         string
	serviceEntryName string
	routeName        string
	source           string
	ruleSetID        string
	ruleID           string
	displayName      string
	sourceURL        string
	action           string
	proxyID          string
	priority         int
}

type egressProxyAddress struct {
	proxyID     string
	displayName string
	address     string
	port        int64
	isIP        bool
}

func newTarget(hostname string) (egressTarget, error) {
	exact, err := parseExactHostname(hostname)
	if err != nil {
		return egressTarget{}, err
	}
	return newTargetForHostPattern(exact)
}

func newTargetForHostPattern(hostPattern string) (egressTarget, error) {
	hostPattern = normalizeHostname(hostPattern)
	if strings.HasPrefix(hostPattern, "*.") {
		suffix, err := parseSuffixHostname(hostPattern)
		if err != nil {
			return egressTarget{}, err
		}
		hostPattern = wildcardHostForSuffix(suffix)
	} else {
		exact, err := parseExactHostname(hostPattern)
		if err != nil {
			return egressTarget{}, err
		}
		hostPattern = exact
	}
	name := targetResourceName(hostPattern)
	return egressTarget{
		hostname:         hostPattern,
		serviceEntryName: name,
		routeName:        name,
		action:           egressActionDirect,
	}, nil
}

func targetResourceName(hostname string) string {
	return stableResourceName(targetResourcePrefix, hostname)
}

func proxyResourceName(proxyID string) string {
	return stableResourceName(proxyResourcePrefix, proxyID)
}

func targetSubsetName(target egressTarget) string {
	return target.routeName
}

func stableResourceName(prefix string, value string) string {
	slug := strings.NewReplacer(".", "-", "_", "-", "*", "wildcard").Replace(strings.ToLower(value))
	if len(slug) > 30 {
		slug = slug[:30]
	}
	sum := sha1.Sum([]byte(value))
	return prefix + "-" + strings.Trim(slug, "-") + "-" + hex.EncodeToString(sum[:])[:10]
}

func parseHTTPProxyAddress(proxyID string, raw string) (*egressProxyAddress, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, fmt.Errorf("egress proxy %q url is empty", proxyID)
	}
	if !strings.Contains(value, "://") {
		value = "http://" + value
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return nil, fmt.Errorf("parse egress proxy %q url: %w", proxyID, err)
	}
	if parsed.Scheme != "http" || parsed.Hostname() == "" {
		return nil, fmt.Errorf("egress proxy %q must be an HTTP proxy URL", proxyID)
	}
	port := int64(80)
	if parsed.Port() != "" {
		parsedPort, err := strconv.ParseInt(parsed.Port(), 10, 32)
		if err != nil || parsedPort <= 0 || parsedPort > 65535 {
			return nil, fmt.Errorf("egress proxy %q port is invalid", proxyID)
		}
		port = parsedPort
	}
	address := parsed.Hostname()
	return &egressProxyAddress{
		proxyID: proxyID,
		address: address,
		port:    port,
		isIP:    net.ParseIP(address) != nil,
	}, nil
}

func proxyURL(proxy egressProxyAddress) string {
	return fmt.Sprintf("http://%s:%d", proxy.address, proxy.port)
}

func sortTargets(targets []egressTarget) {
	sort.Slice(targets, func(i, j int) bool {
		return targets[i].hostname < targets[j].hostname
	})
}

func sortProxies(proxies []egressProxyAddress) {
	sort.Slice(proxies, func(i, j int) bool {
		return proxies[i].proxyID < proxies[j].proxyID
	})
}
