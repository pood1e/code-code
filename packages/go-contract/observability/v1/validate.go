package observabilityv1

import (
	"fmt"
	"regexp"
	"strings"

	"google.golang.org/protobuf/types/known/durationpb"
)

var (
	promMetricNamePattern     = regexp.MustCompile(`^[a-zA-Z_:][a-zA-Z0-9_:]*$`)
	semanticMetricNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`)
	attributeNamePattern      = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`)
	metricUnitPattern         = regexp.MustCompile(`^(1|%|[a-zA-Z][a-zA-Z0-9./%-]*|\{[a-z][a-z0-9_.-]*\})$`)
	collectorIDPattern        = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)
)

// ValidateCapability validates one observability capability block.
func ValidateCapability(capability *ObservabilityCapability) error {
	if capability == nil {
		return fmt.Errorf("observabilityv1: capability is nil")
	}

	profileIDs := make(map[string]struct{}, len(capability.GetProfiles()))
	for _, profile := range capability.GetProfiles() {
		if profile == nil {
			return fmt.Errorf("observabilityv1: profile is nil")
		}
		profileID := strings.TrimSpace(profile.GetProfileId())
		if profileID == "" {
			return fmt.Errorf("observabilityv1: profile id is empty")
		}
		if _, exists := profileIDs[profileID]; exists {
			return fmt.Errorf("observabilityv1: duplicate profile id %q", profileID)
		}
		profileIDs[profileID] = struct{}{}
		if err := ValidateProfile(profile); err != nil {
			return fmt.Errorf("observabilityv1: profile %q: %w", profileID, err)
		}
	}
	return nil
}

// ValidateProfile validates one observability profile.
func ValidateProfile(profile *ObservabilityProfile) error {
	if profile == nil {
		return fmt.Errorf("observabilityv1: profile is nil")
	}
	if strings.TrimSpace(profile.GetProfileId()) == "" {
		return fmt.Errorf("observabilityv1: profile id is empty")
	}
	if strings.TrimSpace(profile.GetDisplayName()) == "" {
		return fmt.Errorf("observabilityv1: profile display name is empty")
	}
	if len(profile.GetMetrics()) == 0 {
		return fmt.Errorf("observabilityv1: profile metrics are empty")
	}

	metricNames := make(map[string]struct{}, len(profile.GetMetrics()))
	metricAttributeNames := make(map[string]map[string]struct{}, len(profile.GetMetrics()))
	for _, metric := range profile.GetMetrics() {
		if metric == nil {
			return fmt.Errorf("observabilityv1: metric is nil")
		}
		name := strings.TrimSpace(metric.GetName())
		if _, exists := metricNames[name]; exists {
			return fmt.Errorf("observabilityv1: duplicate metric name %q", name)
		}
		metricNames[name] = struct{}{}
		if err := ValidateMetric(metric); err != nil {
			return fmt.Errorf("observabilityv1: metric %q: %w", name, err)
		}
		attributeNames := make(map[string]struct{}, len(metric.GetAttributes()))
		for _, attribute := range metric.GetAttributes() {
			if attribute == nil {
				continue
			}
			attributeNames[strings.TrimSpace(attribute.GetName())] = struct{}{}
		}
		metricAttributeNames[name] = attributeNames
	}

	activeQuery := profile.GetActiveQuery()
	responseHeaders := profile.GetResponseHeaders()
	switch {
	case activeQuery != nil && responseHeaders != nil:
		return fmt.Errorf("observabilityv1: profile collection must be either active_query or response_headers")
	case activeQuery == nil && responseHeaders == nil:
		return fmt.Errorf("observabilityv1: profile collection is empty")
	case activeQuery != nil:
		if err := validateActiveQuery(activeQuery); err != nil {
			return err
		}
	case responseHeaders != nil:
		if err := validateResponseHeaders(responseHeaders, metricNames, metricAttributeNames); err != nil {
			return err
		}
	}

	queryIDs := make(map[string]struct{}, len(profile.GetMetricQueries()))
	for _, query := range profile.GetMetricQueries() {
		if query == nil {
			return fmt.Errorf("observabilityv1: metric query is nil")
		}
		queryID := strings.TrimSpace(query.GetQueryId())
		if _, exists := queryIDs[queryID]; exists {
			return fmt.Errorf("observabilityv1: duplicate metric query id %q", queryID)
		}
		queryIDs[queryID] = struct{}{}
		if err := validateMetricQuery(query, metricNames); err != nil {
			return fmt.Errorf("observabilityv1: metric query %q: %w", queryID, err)
		}
	}

	if availability := profile.GetAvailabilityJudgment(); availability != nil {
		if err := validateAvailability(availability, queryIDs); err != nil {
			return err
		}
	}
	return nil
}

// ValidateMetric validates one observability metric.
func ValidateMetric(metric *ObservabilityMetric) error {
	if metric == nil {
		return fmt.Errorf("observabilityv1: metric is nil")
	}
	name := strings.TrimSpace(metric.GetName())
	if name == "" {
		return fmt.Errorf("observabilityv1: metric name is empty")
	}
	if !promMetricNamePattern.MatchString(name) && !semanticMetricNamePattern.MatchString(name) {
		return fmt.Errorf("observabilityv1: metric name %q must be Prometheus-compatible or OTel semantic style", name)
	}
	if strings.TrimSpace(metric.GetDescription()) == "" {
		return fmt.Errorf("observabilityv1: metric description is empty")
	}
	unit := strings.TrimSpace(metric.GetUnit())
	if unit != "" && !metricUnitPattern.MatchString(unit) {
		return fmt.Errorf("observabilityv1: metric unit %q is not OTel-compatible", unit)
	}
	if metric.GetKind() == ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: metric kind is unspecified")
	}
	if metric.GetCategory() == ObservabilityMetricCategory_OBSERVABILITY_METRIC_CATEGORY_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: metric category is unspecified")
	}
	if err := validateMetricNameAndUnit(name, unit, metric.GetKind()); err != nil {
		return err
	}
	attributeNames := make(map[string]struct{}, len(metric.GetAttributes()))
	for _, attribute := range metric.GetAttributes() {
		if attribute == nil {
			return fmt.Errorf("observabilityv1: metric attribute is nil")
		}
		name := strings.TrimSpace(attribute.GetName())
		if name == "" {
			return fmt.Errorf("observabilityv1: metric attribute name is empty")
		}
		if !attributeNamePattern.MatchString(name) {
			return fmt.Errorf("observabilityv1: metric attribute %q must use lower_snake or dot.namespace style", name)
		}
		if _, exists := attributeNames[name]; exists {
			return fmt.Errorf("observabilityv1: duplicate metric attribute %q", name)
		}
		attributeNames[name] = struct{}{}
		if strings.TrimSpace(attribute.GetDescription()) == "" {
			return fmt.Errorf("observabilityv1: metric attribute %q description is empty", name)
		}
		if attribute.GetRequirementLevel() == ObservabilityAttributeRequirementLevel_OBSERVABILITY_ATTRIBUTE_REQUIREMENT_LEVEL_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: metric attribute %q requirement level is unspecified", name)
		}
	}
	return nil
}

func validateMetricNameAndUnit(name, unit string, kind ObservabilityMetricKind) error {
	counterSuffix := "_total"
	secondsSuffix := "_seconds"
	timestampSecondsSuffix := "_timestamp_seconds"
	if semanticMetricNamePattern.MatchString(name) {
		counterSuffix = ".total"
		secondsSuffix = ".seconds"
		timestampSecondsSuffix = ".timestamp.seconds"
	}

	if kind == ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER && !strings.HasSuffix(name, counterSuffix) {
		return fmt.Errorf("observabilityv1: counter metric %q must end with %q", name, counterSuffix)
	}
	if kind != ObservabilityMetricKind_OBSERVABILITY_METRIC_KIND_COUNTER && strings.HasSuffix(name, counterSuffix) {
		return fmt.Errorf("observabilityv1: non-counter metric %q must not end with %q", name, counterSuffix)
	}
	if unit != "s" {
		return nil
	}
	if strings.Contains(name, "timestamp") {
		if !strings.HasSuffix(name, timestampSecondsSuffix) {
			return fmt.Errorf("observabilityv1: timestamp metric %q must end with %q", name, timestampSecondsSuffix)
		}
		return nil
	}
	if !strings.HasSuffix(name, secondsSuffix) {
		return fmt.Errorf("observabilityv1: seconds metric %q must end with %q", name, secondsSuffix)
	}
	return nil
}

func validateActiveQuery(collection *ActiveQueryCollection) error {
	if collection == nil {
		return fmt.Errorf("observabilityv1: active query collection is nil")
	}
	if err := validatePositiveDuration(collection.GetMinimumPollInterval()); err != nil {
		return fmt.Errorf("observabilityv1: active query minimum_poll_interval: %w", err)
	}
	if rawCollectorID := collection.GetCollectorId(); rawCollectorID != "" {
		collectorID := strings.TrimSpace(rawCollectorID)
		if collectorID == "" {
			return fmt.Errorf("observabilityv1: active query collector_id is empty")
		}
		if !collectorIDPattern.MatchString(collectorID) {
			return fmt.Errorf("observabilityv1: active query collector_id %q is invalid", collectorID)
		}
	}
	dynamicParameterIDs := make(map[string]struct{}, len(collection.GetDynamicParameters()))
	for _, parameter := range collection.GetDynamicParameters() {
		if parameter == nil {
			return fmt.Errorf("observabilityv1: dynamic parameter is nil")
		}
		parameterID := strings.TrimSpace(parameter.GetParameterId())
		if parameterID == "" {
			return fmt.Errorf("observabilityv1: dynamic parameter id is empty")
		}
		if _, exists := dynamicParameterIDs[parameterID]; exists {
			return fmt.Errorf("observabilityv1: duplicate dynamic parameter id %q", parameterID)
		}
		dynamicParameterIDs[parameterID] = struct{}{}
		if strings.TrimSpace(parameter.GetDisplayName()) == "" {
			return fmt.Errorf("observabilityv1: dynamic parameter %q display name is empty", parameterID)
		}
	}
	return nil
}

func validatePositiveDuration(value *durationpb.Duration) error {
	if value == nil {
		return fmt.Errorf("duration is nil")
	}
	if err := value.CheckValid(); err != nil {
		return err
	}
	if value.AsDuration() <= 0 {
		return fmt.Errorf("duration must be positive")
	}
	return nil
}

func validateResponseHeaders(collection *ResponseHeaderCollection, metricNames map[string]struct{}, metricAttributeNames map[string]map[string]struct{}) error {
	if collection == nil {
		return fmt.Errorf("observabilityv1: response header collection is nil")
	}
	if len(collection.GetHeaderMetricMappings()) == 0 {
		return fmt.Errorf("observabilityv1: response header collection mappings are empty")
	}
	headerNames := make(map[string]struct{}, len(collection.GetHeaderMetricMappings()))
	for _, mapping := range collection.GetHeaderMetricMappings() {
		if mapping == nil {
			return fmt.Errorf("observabilityv1: header metric mapping is nil")
		}
		headerName := strings.TrimSpace(mapping.GetHeaderName())
		if headerName == "" {
			return fmt.Errorf("observabilityv1: header metric mapping header name is empty")
		}
		if headerName != strings.ToLower(headerName) {
			return fmt.Errorf("observabilityv1: header metric mapping header %q must be lower-case", headerName)
		}
		if _, exists := headerNames[headerName]; exists {
			return fmt.Errorf("observabilityv1: duplicate response header mapping %q", headerName)
		}
		headerNames[headerName] = struct{}{}
		metricName := strings.TrimSpace(mapping.GetMetricName())
		if metricName == "" {
			return fmt.Errorf("observabilityv1: header metric mapping %q metric name is empty", headerName)
		}
		if _, exists := metricNames[metricName]; !exists {
			return fmt.Errorf("observabilityv1: header metric mapping %q references unknown metric %q", headerName, metricName)
		}
		if mapping.GetValueType() == HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: header metric mapping %q value type is unspecified", headerName)
		}
		declaredAttributes := metricAttributeNames[metricName]
		labelNames := make(map[string]struct{}, len(mapping.GetLabels()))
		for _, label := range mapping.GetLabels() {
			if label == nil {
				return fmt.Errorf("observabilityv1: header metric mapping %q label is nil", headerName)
			}
			labelName := strings.TrimSpace(label.GetName())
			if labelName == "" {
				return fmt.Errorf("observabilityv1: header metric mapping %q label name is empty", headerName)
			}
			if !attributeNamePattern.MatchString(labelName) {
				return fmt.Errorf("observabilityv1: header metric mapping %q label %q must use lower_snake or dot.namespace style", headerName, labelName)
			}
			if _, exists := labelNames[labelName]; exists {
				return fmt.Errorf("observabilityv1: header metric mapping %q has duplicate label %q", headerName, labelName)
			}
			labelNames[labelName] = struct{}{}
			if strings.TrimSpace(label.GetValue()) == "" {
				return fmt.Errorf("observabilityv1: header metric mapping %q label %q value is empty", headerName, labelName)
			}
			if _, exists := declaredAttributes[labelName]; !exists {
				return fmt.Errorf("observabilityv1: header metric mapping %q label %q is not declared by metric %q", headerName, labelName, metricName)
			}
		}
	}
	return nil
}

func validateMetricQuery(query *MetricQuery, metricNames map[string]struct{}) error {
	if query == nil {
		return fmt.Errorf("observabilityv1: metric query is nil")
	}
	queryID := strings.TrimSpace(query.GetQueryId())
	if queryID == "" {
		return fmt.Errorf("observabilityv1: metric query id is empty")
	}
	if strings.TrimSpace(query.GetDisplayName()) == "" {
		return fmt.Errorf("observabilityv1: metric query %q display name is empty", queryID)
	}
	if query.GetLanguage() == MetricQueryLanguage_METRIC_QUERY_LANGUAGE_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: metric query %q language is unspecified", queryID)
	}
	if strings.TrimSpace(query.GetStatement()) == "" {
		return fmt.Errorf("observabilityv1: metric query %q statement is empty", queryID)
	}
	if len(query.GetMetricNames()) == 0 {
		return fmt.Errorf("observabilityv1: metric query %q metric_names are empty", queryID)
	}
	for _, metricName := range query.GetMetricNames() {
		name := strings.TrimSpace(metricName)
		if _, exists := metricNames[name]; !exists {
			return fmt.Errorf("observabilityv1: metric query %q references unknown metric %q", queryID, name)
		}
	}
	if query.GetResultKind() == MetricQueryResultKind_METRIC_QUERY_RESULT_KIND_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: metric query %q result kind is unspecified", queryID)
	}
	return nil
}

func validateAvailability(availability *AvailabilityJudgment, queryIDs map[string]struct{}) error {
	if availability == nil {
		return fmt.Errorf("observabilityv1: availability judgment is nil")
	}
	if availability.GetSubjectKind() == AvailabilitySubjectKind_AVAILABILITY_SUBJECT_KIND_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: availability subject kind is unspecified")
	}
	if strings.TrimSpace(availability.GetSubjectLabelKey()) == "" {
		return fmt.Errorf("observabilityv1: availability subject label key is empty")
	}
	if len(availability.GetQueryIds()) == 0 {
		return fmt.Errorf("observabilityv1: availability query ids are empty")
	}
	for _, queryID := range availability.GetQueryIds() {
		id := strings.TrimSpace(queryID)
		if _, exists := queryIDs[id]; !exists {
			return fmt.Errorf("observabilityv1: availability references unknown query %q", id)
		}
	}
	ruleIDs := make(map[string]struct{}, len(availability.GetRules()))
	for _, rule := range availability.GetRules() {
		if rule == nil {
			return fmt.Errorf("observabilityv1: availability rule is nil")
		}
		ruleID := strings.TrimSpace(rule.GetRuleId())
		if ruleID == "" {
			return fmt.Errorf("observabilityv1: availability rule id is empty")
		}
		if _, exists := ruleIDs[ruleID]; exists {
			return fmt.Errorf("observabilityv1: duplicate availability rule id %q", ruleID)
		}
		ruleIDs[ruleID] = struct{}{}
		if strings.TrimSpace(rule.GetDisplayName()) == "" {
			return fmt.Errorf("observabilityv1: availability rule %q display name is empty", ruleID)
		}
		if len(rule.GetAllOf()) == 0 {
			return fmt.Errorf("observabilityv1: availability rule %q predicates are empty", ruleID)
		}
		if rule.GetState() == AvailabilityState_AVAILABILITY_STATE_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: availability rule %q state is unspecified", ruleID)
		}
		for _, predicate := range rule.GetAllOf() {
			if predicate == nil {
				return fmt.Errorf("observabilityv1: availability rule %q predicate is nil", ruleID)
			}
			queryID := strings.TrimSpace(predicate.GetQueryId())
			if _, exists := queryIDs[queryID]; !exists {
				return fmt.Errorf("observabilityv1: availability rule %q references unknown query %q", ruleID, queryID)
			}
			if predicate.GetOperator() == ComparisonOperator_COMPARISON_OPERATOR_UNSPECIFIED {
				return fmt.Errorf("observabilityv1: availability rule %q predicate operator is unspecified", ruleID)
			}
		}
	}
	return nil
}
