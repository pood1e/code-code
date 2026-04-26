package envoyauthprocessor

import (
	"strconv"
	"strings"
	"time"
)

func (headers requestHeaders) statusCode() int {
	status, err := strconv.Atoi(strings.TrimSpace(headers.get(":status")))
	if err != nil {
		return 0
	}
	return status
}

func statusClass(status int) string {
	switch {
	case status >= 200 && status < 300:
		return "2xx"
	case status >= 400 && status < 500:
		return "4xx"
	case status >= 500 && status < 600:
		return "5xx"
	default:
		return "other"
	}
}

func parseHeaderMetricValue(rawValue string, valueType string) (float64, bool) {
	value := strings.TrimSpace(rawValue)
	if value == "" {
		return 0, false
	}
	switch strings.TrimSpace(valueType) {
	case "int64":
		parsed, err := strconv.ParseInt(value, 10, 64)
		return float64(parsed), err == nil
	case "double", "unix_seconds":
		parsed, err := strconv.ParseFloat(value, 64)
		return parsed, err == nil
	case "duration_seconds":
		return parseDurationSeconds(value)
	case "rfc3339_timestamp":
		parsed, err := time.Parse(time.RFC3339, value)
		return float64(parsed.Unix()), err == nil
	default:
		return 0, false
	}
}

func parseDurationSeconds(value string) (float64, bool) {
	if parsed, err := strconv.ParseFloat(value, 64); err == nil {
		return parsed, true
	}
	total := 0.0
	position := 0
	for _, match := range durationPartPattern.FindAllStringSubmatchIndex(value, -1) {
		if match[0] != position {
			return 0, false
		}
		magnitude, err := strconv.ParseFloat(value[match[2]:match[3]], 64)
		if err != nil {
			return 0, false
		}
		switch value[match[4]:match[5]] {
		case "ns":
			total += magnitude / 1_000_000_000
		case "us", "µs":
			total += magnitude / 1_000_000
		case "ms":
			total += magnitude / 1_000
		case "s":
			total += magnitude
		case "m":
			total += magnitude * 60
		case "h":
			total += magnitude * 3600
		}
		position = match[1]
	}
	return total, position == len(value)
}
