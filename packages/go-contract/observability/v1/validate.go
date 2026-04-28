package observabilityv1

import (
	"fmt"
	"regexp"
	"strings"

	"google.golang.org/protobuf/types/known/durationpb"
)

var (
	promMetricNamePattern        = regexp.MustCompile(`^[a-zA-Z_:][a-zA-Z0-9_:]*$`)
	semanticMetricNamePattern    = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`)
	attributeNamePattern         = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`)
	metricUnitPattern            = regexp.MustCompile(`^(1|%|[a-zA-Z][a-zA-Z0-9./%-]*|\{[a-z][a-z0-9_.-]*\})$`)
	collectorIDPattern           = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)
	credentialMaterialKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	httpHeaderNamePattern        = regexp.MustCompile(`^[a-z0-9][a-z0-9!#$%&'*+.^_` + "`" + `|~-]*$`)
)

var sensitiveHeaderNames = map[string]struct{}{
	"authorization":       {},
	"cookie":              {},
	"proxy-authorization": {},
	"set-cookie":          {},
	"x-api-key":           {},
}

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
	passiveHTTP := profile.GetPassiveHttp()
	switch {
	case activeQuery != nil && passiveHTTP != nil:
		return fmt.Errorf("observabilityv1: profile collection must be either active_query or passive_http")
	case activeQuery == nil && passiveHTTP == nil:
		return fmt.Errorf("observabilityv1: profile collection is empty")
	case activeQuery != nil:
		if err := validateActiveQuery(activeQuery); err != nil {
			return err
		}
	case passiveHTTP != nil:
		if err := validatePassiveHTTP(passiveHTTP, metricNames, metricAttributeNames); err != nil {
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
	if err := validateCredentialBackfills(collection.GetCredentialBackfills()); err != nil {
		return err
	}
	if err := validateMaterialReadFields(collection.GetMaterialReadFields()); err != nil {
		return err
	}
	if err := validateActiveQueryInputForm(collection.GetInputForm()); err != nil {
		return err
	}
	return nil
}

func validateMaterialReadFields(fields []string) error {
	seen := make(map[string]struct{}, len(fields))
	for _, raw := range fields {
		field := strings.TrimSpace(raw)
		if field == "" {
			return fmt.Errorf("observabilityv1: active query material_read_fields contains empty field")
		}
		if !credentialMaterialKeyPattern.MatchString(field) {
			return fmt.Errorf("observabilityv1: active query material_read_fields field %q is invalid", field)
		}
		if _, exists := seen[field]; exists {
			return fmt.Errorf("observabilityv1: duplicate active query material_read_fields field %q", field)
		}
		seen[field] = struct{}{}
	}
	return nil
}

func validateActiveQueryInputForm(form *ActiveQueryInputForm) error {
	if form == nil {
		return nil
	}
	schemaID := strings.TrimSpace(form.GetSchemaId())
	if schemaID == "" {
		return fmt.Errorf("observabilityv1: active query input form schema_id is empty")
	}
	if !collectorIDPattern.MatchString(schemaID) {
		return fmt.Errorf("observabilityv1: active query input form schema_id %q is invalid", schemaID)
	}
	if strings.TrimSpace(form.GetTitle()) == "" {
		return fmt.Errorf("observabilityv1: active query input form title is empty")
	}
	if strings.TrimSpace(form.GetActionLabel()) == "" {
		return fmt.Errorf("observabilityv1: active query input form action_label is empty")
	}
	if len(form.GetFields()) == 0 {
		return fmt.Errorf("observabilityv1: active query input form fields are empty")
	}

	fieldIDs := make(map[string]struct{}, len(form.GetFields()))
	storedFieldIDs := make(map[string]struct{}, len(form.GetFields()))
	for _, field := range form.GetFields() {
		if field == nil {
			return fmt.Errorf("observabilityv1: active query input field is nil")
		}
		fieldID := strings.TrimSpace(field.GetFieldId())
		if fieldID == "" {
			return fmt.Errorf("observabilityv1: active query input field id is empty")
		}
		if !credentialMaterialKeyPattern.MatchString(fieldID) {
			return fmt.Errorf("observabilityv1: active query input field id %q is invalid", fieldID)
		}
		if _, exists := fieldIDs[fieldID]; exists {
			return fmt.Errorf("observabilityv1: duplicate active query input field id %q", fieldID)
		}
		fieldIDs[fieldID] = struct{}{}
		if strings.TrimSpace(field.GetLabel()) == "" {
			return fmt.Errorf("observabilityv1: active query input field %q label is empty", fieldID)
		}
		if field.GetControl() == ActiveQueryInputControl_ACTIVE_QUERY_INPUT_CONTROL_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: active query input field %q control is unspecified", fieldID)
		}
		if field.GetSensitive() && strings.TrimSpace(field.GetDefaultValue()) != "" {
			return fmt.Errorf("observabilityv1: active query input field %q default_value is not allowed for sensitive fields", fieldID)
		}
		switch field.GetPersistence() {
		case ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_STORED_MATERIAL:
			if strings.TrimSpace(field.GetTargetFieldId()) != "" {
				return fmt.Errorf("observabilityv1: stored active query input field %q target_field_id must be empty", fieldID)
			}
			if transform := field.GetTransform(); transform != ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_UNSPECIFIED &&
				transform != ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_IDENTITY {
				return fmt.Errorf("observabilityv1: stored active query input field %q transform must be identity", fieldID)
			}
			storedFieldIDs[fieldID] = struct{}{}
		case ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_TRANSIENT:
			if field.GetRequired() {
				return fmt.Errorf("observabilityv1: transient active query input field %q must not be required", fieldID)
			}
			targetFieldID := strings.TrimSpace(field.GetTargetFieldId())
			if targetFieldID == "" {
				return fmt.Errorf("observabilityv1: transient active query input field %q target_field_id is empty", fieldID)
			}
			if !credentialMaterialKeyPattern.MatchString(targetFieldID) {
				return fmt.Errorf("observabilityv1: transient active query input field %q target_field_id %q is invalid", fieldID, targetFieldID)
			}
			if field.GetTransform() == ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_UNSPECIFIED ||
				field.GetTransform() == ActiveQueryInputValueTransform_ACTIVE_QUERY_INPUT_VALUE_TRANSFORM_IDENTITY {
				return fmt.Errorf("observabilityv1: transient active query input field %q transform is required", fieldID)
			}
		default:
			return fmt.Errorf("observabilityv1: active query input field %q persistence is unspecified", fieldID)
		}
	}
	for _, field := range form.GetFields() {
		if field.GetPersistence() != ActiveQueryInputPersistence_ACTIVE_QUERY_INPUT_PERSISTENCE_TRANSIENT {
			continue
		}
		targetFieldID := strings.TrimSpace(field.GetTargetFieldId())
		if _, exists := storedFieldIDs[targetFieldID]; !exists {
			return fmt.Errorf("observabilityv1: transient active query input field %q target_field_id %q does not reference a stored field", field.GetFieldId(), targetFieldID)
		}
	}
	return nil
}

func validateCredentialBackfills(rules []*CredentialBackfillRule) error {
	ruleIDs := make(map[string]struct{}, len(rules))
	targetKeys := make(map[string]struct{}, len(rules))
	for _, rule := range rules {
		if rule == nil {
			return fmt.Errorf("observabilityv1: credential backfill rule is nil")
		}
		ruleID := strings.TrimSpace(rule.GetRuleId())
		if ruleID == "" {
			return fmt.Errorf("observabilityv1: credential backfill rule id is empty")
		}
		if !collectorIDPattern.MatchString(ruleID) {
			return fmt.Errorf("observabilityv1: credential backfill rule id %q is invalid", ruleID)
		}
		if _, exists := ruleIDs[ruleID]; exists {
			return fmt.Errorf("observabilityv1: duplicate credential backfill rule id %q", ruleID)
		}
		ruleIDs[ruleID] = struct{}{}

		source := rule.GetSource()
		if source == CredentialBackfillSource_CREDENTIAL_BACKFILL_SOURCE_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: credential backfill %q source is unspecified", ruleID)
		}
		sourceName := strings.TrimSpace(rule.GetSourceName())
		if sourceName == "" {
			return fmt.Errorf("observabilityv1: credential backfill %q source_name is empty", ruleID)
		}
		if strings.ContainsAny(sourceName, " \t\r\n") {
			return fmt.Errorf("observabilityv1: credential backfill %q source_name contains whitespace", ruleID)
		}
		if source == CredentialBackfillSource_CREDENTIAL_BACKFILL_SOURCE_HTTP_RESPONSE_HEADER {
			headerName := strings.ToLower(sourceName)
			if headerName != sourceName {
				return fmt.Errorf("observabilityv1: credential backfill %q response header source_name must be lower-case", ruleID)
			}
			if err := validateHTTPHeaderName(headerName); err != nil {
				return fmt.Errorf("observabilityv1: credential backfill %q response header: %w", ruleID, err)
			}
		}

		targetKey := strings.TrimSpace(rule.GetTargetMaterialKey())
		if targetKey == "" {
			return fmt.Errorf("observabilityv1: credential backfill %q target_material_key is empty", ruleID)
		}
		if !credentialMaterialKeyPattern.MatchString(targetKey) {
			return fmt.Errorf("observabilityv1: credential backfill %q target_material_key %q is invalid", ruleID, targetKey)
		}
		if _, exists := targetKeys[targetKey]; exists {
			return fmt.Errorf("observabilityv1: duplicate credential backfill target_material_key %q", targetKey)
		}
		targetKeys[targetKey] = struct{}{}
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

func validatePassiveHTTP(collection *PassiveHttpTelemetryCollection, metricNames map[string]struct{}, metricAttributeNames map[string]map[string]struct{}) error {
	if collection == nil {
		return fmt.Errorf("observabilityv1: passive http collection is nil")
	}
	if collection.GetCapturePoint() == TelemetryCapturePoint_TELEMETRY_CAPTURE_POINT_UNSPECIFIED {
		return fmt.Errorf("observabilityv1: passive http capture_point is unspecified")
	}
	if len(collection.GetTransforms()) == 0 {
		return fmt.Errorf("observabilityv1: passive http transforms are empty")
	}
	for index, selector := range collection.GetSelectors() {
		if selector == nil {
			return fmt.Errorf("observabilityv1: passive http selector %d is nil", index)
		}
		if err := validatePassiveHTTPSelector(index, selector); err != nil {
			return err
		}
	}
	transformKeys := make(map[string]struct{}, len(collection.GetTransforms()))
	for _, transform := range collection.GetTransforms() {
		if transform == nil {
			return fmt.Errorf("observabilityv1: passive http transform is nil")
		}
		source := transform.GetSource()
		if source == HttpHeaderSource_HTTP_HEADER_SOURCE_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: passive http transform source is unspecified")
		}
		headerName := strings.ToLower(strings.TrimSpace(transform.GetHeaderName()))
		if err := validateHTTPHeaderName(headerName); err != nil {
			return fmt.Errorf("observabilityv1: passive http transform header: %w", err)
		}
		if isSensitiveHeaderName(headerName) {
			return fmt.Errorf("observabilityv1: passive http transform header %q is sensitive", headerName)
		}
		key := source.String() + "\x00" + headerName + "\x00" + strings.TrimSpace(transform.GetMetricName())
		if _, exists := transformKeys[key]; exists {
			return fmt.Errorf("observabilityv1: duplicate passive http transform for header %q", headerName)
		}
		transformKeys[key] = struct{}{}
		metricName := strings.TrimSpace(transform.GetMetricName())
		if metricName == "" {
			return fmt.Errorf("observabilityv1: passive http transform %q metric name is empty", headerName)
		}
		if _, exists := metricNames[metricName]; !exists {
			return fmt.Errorf("observabilityv1: passive http transform %q references unknown metric %q", headerName, metricName)
		}
		if transform.GetValueType() == HeaderValueType_HEADER_VALUE_TYPE_UNSPECIFIED {
			return fmt.Errorf("observabilityv1: passive http transform %q value type is unspecified", headerName)
		}
		declaredAttributes := metricAttributeNames[metricName]
		labelNames := make(map[string]struct{}, len(transform.GetLabels()))
		for _, label := range transform.GetLabels() {
			if label == nil {
				return fmt.Errorf("observabilityv1: passive http transform %q label is nil", headerName)
			}
			labelName := strings.TrimSpace(label.GetName())
			if labelName == "" {
				return fmt.Errorf("observabilityv1: passive http transform %q label name is empty", headerName)
			}
			if !attributeNamePattern.MatchString(labelName) {
				return fmt.Errorf("observabilityv1: passive http transform %q label %q must use lower_snake or dot.namespace style", headerName, labelName)
			}
			if _, exists := labelNames[labelName]; exists {
				return fmt.Errorf("observabilityv1: passive http transform %q has duplicate label %q", headerName, labelName)
			}
			labelNames[labelName] = struct{}{}
			if strings.TrimSpace(label.GetValue()) == "" {
				return fmt.Errorf("observabilityv1: passive http transform %q label %q value is empty", headerName, labelName)
			}
			if _, exists := declaredAttributes[labelName]; !exists {
				return fmt.Errorf("observabilityv1: passive http transform %q label %q is not declared by metric %q", headerName, labelName, metricName)
			}
		}
	}
	redaction := collection.GetRedaction()
	if redaction == nil {
		return fmt.Errorf("observabilityv1: passive http redaction is required")
	}
	if !redaction.GetDropRawHeaders() {
		return fmt.Errorf("observabilityv1: passive http redaction must drop raw headers")
	}
	redactionHeaders := append(append([]string(nil), redaction.GetHashHeaders()...), redaction.GetRedactHeaders()...)
	redactionHeaderNames := make(map[string]struct{}, len(redactionHeaders))
	for _, headerName := range redactionHeaders {
		headerName = strings.ToLower(strings.TrimSpace(headerName))
		if err := validateHTTPHeaderName(headerName); err != nil {
			return fmt.Errorf("observabilityv1: passive http redaction header: %w", err)
		}
		if _, exists := redactionHeaderNames[headerName]; exists {
			return fmt.Errorf("observabilityv1: passive http redaction header %q is duplicated", headerName)
		}
		redactionHeaderNames[headerName] = struct{}{}
	}
	return nil
}

func validatePassiveHTTPSelector(index int, selector *HttpTelemetrySelector) error {
	for _, method := range selector.GetMethods() {
		method = strings.TrimSpace(method)
		if method == "" || method != strings.ToUpper(method) {
			return fmt.Errorf("observabilityv1: passive http selector %d method %q must be upper-case", index, method)
		}
	}
	for _, prefix := range selector.GetPathPrefixes() {
		prefix = strings.TrimSpace(prefix)
		if prefix == "" || !strings.HasPrefix(prefix, "/") {
			return fmt.Errorf("observabilityv1: passive http selector %d path_prefix %q must start with /", index, prefix)
		}
	}
	for _, status := range selector.GetStatusCodes() {
		if status < 100 || status > 599 {
			return fmt.Errorf("observabilityv1: passive http selector %d status_code %d is invalid", index, status)
		}
	}
	for _, hostname := range selector.GetHostnames() {
		if strings.TrimSpace(hostname) == "" {
			return fmt.Errorf("observabilityv1: passive http selector %d hostname is empty", index)
		}
	}
	return nil
}

func validateHTTPHeaderName(value string) error {
	if value == "" {
		return fmt.Errorf("header name is empty")
	}
	if value != strings.ToLower(value) {
		return fmt.Errorf("header %q must be lower-case", value)
	}
	if !httpHeaderNamePattern.MatchString(value) {
		return fmt.Errorf("header %q is invalid", value)
	}
	return nil
}

func isSensitiveHeaderName(value string) bool {
	_, ok := sensitiveHeaderNames[strings.ToLower(strings.TrimSpace(value))]
	return ok
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
