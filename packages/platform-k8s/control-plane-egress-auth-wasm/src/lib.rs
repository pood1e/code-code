use log::warn;
use proxy_wasm::hostcalls;
use proxy_wasm::traits::*;
use proxy_wasm::types::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;

const DEFAULT_AUTH_SERVICE_CLUSTER: &str =
    "outbound|8081||platform-auth-service.code-code.svc.cluster.local";
const DEFAULT_AUTH_SERVICE_NAME: &str = "platform.auth.v1.AuthService";
const DEFAULT_REQUEST_METHOD: &str = "ResolveEgressRequestHeaders";
const DEFAULT_RESPONSE_METHOD: &str = "ResolveEgressResponseHeaders";
const DEFAULT_CALLOUT_TIMEOUT_MILLIS: u64 = 3000;

const HEADER_CREDENTIAL_ID: &str = "x-code-code-credential-id";
const HEADER_AUTH_ADAPTER_ID: &str = "x-code-code-auth-adapter-id";
const HEADER_REQUEST_HEADER_NAMES: &str = "x-code-code-request-header-names";
const HEADER_REQUEST_HEADER_RULES: &str = "x-code-code-request-header-rules-json";
const HEADER_RESPONSE_HEADER_RULES: &str = "x-code-code-response-header-rules-json";
const HEADER_HEADER_VALUE_PREFIX: &str = "x-code-code-header-value-prefix";
const HEADER_RUN_ID: &str = "x-code-code-run-id";
const HEADER_SESSION_ID: &str = "x-code-code-session-id";
const PLACEHOLDER: &str = "PLACEHOLDER";

proxy_wasm::main! {{
    proxy_wasm::set_log_level(LogLevel::Info);
    proxy_wasm::set_root_context(|_| -> Box<dyn RootContext> {
        Box::new(ControlPlaneEgressAuthRoot {
            config: PluginConfig::default(),
        })
    });
}}

#[derive(Clone)]
struct PluginConfig {
    auth_service_cluster: String,
    auth_service_name: String,
    request_method: String,
    response_method: String,
    callout_timeout_millis: u64,
    metrics: Metrics,
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            auth_service_cluster: DEFAULT_AUTH_SERVICE_CLUSTER.to_string(),
            auth_service_name: DEFAULT_AUTH_SERVICE_NAME.to_string(),
            request_method: DEFAULT_REQUEST_METHOD.to_string(),
            response_method: DEFAULT_RESPONSE_METHOD.to_string(),
            callout_timeout_millis: DEFAULT_CALLOUT_TIMEOUT_MILLIS,
            metrics: Metrics::default(),
        }
    }
}

#[derive(Clone, Copy, Default)]
struct Metrics {
    requests_total: u32,
    success_total: u32,
    failure_total: u32,
    skipped_total: u32,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct RawPluginConfig {
    #[serde(alias = "authServiceCluster")]
    auth_service_cluster: String,
    #[serde(alias = "authServiceName")]
    auth_service_name: String,
    #[serde(alias = "authServiceMethod")]
    auth_service_method: String,
    #[serde(alias = "authServiceRequestMethod")]
    auth_service_request_method: String,
    #[serde(alias = "authServiceResponseMethod")]
    auth_service_response_method: String,
    #[serde(alias = "timeoutMilliseconds")]
    timeout_milliseconds: u64,
}

impl RawPluginConfig {
    fn merge(self, mut config: PluginConfig) -> PluginConfig {
        if !self.auth_service_cluster.trim().is_empty() {
            config.auth_service_cluster = self.auth_service_cluster.trim().to_string();
        }
        if !self.auth_service_name.trim().is_empty() {
            config.auth_service_name = self.auth_service_name.trim().to_string();
        }
        if !self.auth_service_method.trim().is_empty() {
            config.request_method = self.auth_service_method.trim().to_string();
        }
        if !self.auth_service_request_method.trim().is_empty() {
            config.request_method = self.auth_service_request_method.trim().to_string();
        }
        if !self.auth_service_response_method.trim().is_empty() {
            config.response_method = self.auth_service_response_method.trim().to_string();
        }
        if self.timeout_milliseconds > 0 {
            config.callout_timeout_millis = self.timeout_milliseconds;
        }
        config
    }
}

struct ControlPlaneEgressAuthRoot {
    config: PluginConfig,
}

impl Context for ControlPlaneEgressAuthRoot {}

impl RootContext for ControlPlaneEgressAuthRoot {
    fn on_configure(&mut self, plugin_configuration_size: usize) -> bool {
        let mut config = PluginConfig::default();
        if plugin_configuration_size > 0 {
            let Some(raw) = self.get_plugin_configuration() else {
                warn!("control-plane egress auth wasm: read plugin config failed");
                return false;
            };
            let Ok(parsed) = serde_json::from_slice::<RawPluginConfig>(&raw) else {
                warn!("control-plane egress auth wasm: parse plugin config failed");
                return false;
            };
            config = parsed.merge(config);
        }
        config.metrics = define_metrics();
        self.config = config;
        true
    }

    fn create_http_context(&self, _: u32) -> Option<Box<dyn HttpContext>> {
        Some(Box::new(ControlPlaneEgressAuthContext {
            config: self.config.clone(),
            context: None,
            pending_call: None,
        }))
    }

    fn get_type(&self) -> Option<ContextType> {
        Some(ContextType::HttpContext)
    }
}

struct ControlPlaneEgressAuthContext {
    config: PluginConfig,
    context: Option<ControlPlaneContext>,
    pending_call: Option<CallPhase>,
}

#[derive(Clone)]
struct ControlPlaneContext {
    credential_id: String,
    adapter_id: String,
    target_host: String,
    target_path: String,
    origin: String,
    header_value_prefix: String,
    request_headers: HashMap<String, String>,
    response_rules: Vec<SimpleReplacementRule>,
}

#[derive(Clone, Copy)]
enum CallPhase {
    RequestHeaders,
    ResponseHeaders,
}

impl Context for ControlPlaneEgressAuthContext {
    fn on_grpc_call_response(&mut self, _: u32, status_code: u32, body_size: usize) {
        self.handle_auth_service_response(status_code, body_size);
    }
}

impl HttpContext for ControlPlaneEgressAuthContext {
    fn on_http_request_headers(&mut self, _: usize, _: bool) -> Action {
        let headers = request_header_map(&self.get_http_request_headers());
        if headers.contains_key(HEADER_RUN_ID) || headers.contains_key(HEADER_SESSION_ID) {
            return Action::Continue;
        }
        let credential_id = trimmed_header(&headers, HEADER_CREDENTIAL_ID);
        if credential_id.is_empty() {
            return Action::Continue;
        }
        let request_rules = parse_simple_rules(&headers, HEADER_REQUEST_HEADER_RULES);
        let response_rules = parse_simple_rules(&headers, HEADER_RESPONSE_HEADER_RULES);
        let mut header_names = split_header_list(headers.get(HEADER_REQUEST_HEADER_NAMES));
        if header_names.is_empty() {
            header_names = simple_rule_header_names(&request_rules);
        }
        let target_host = first_non_empty(&[
            headers.get(":authority").map(String::as_str),
            headers.get("host").map(String::as_str),
        ]);
        let context = ControlPlaneContext {
            credential_id,
            adapter_id: trimmed_header(&headers, HEADER_AUTH_ADAPTER_ID),
            target_host,
            target_path: trimmed_header(&headers, ":path"),
            origin: trimmed_header(&headers, "origin"),
            header_value_prefix: trimmed_header(&headers, HEADER_HEADER_VALUE_PREFIX),
            request_headers: headers.clone(),
            response_rules,
        };
        self.context = Some(context.clone());
        let candidates = placeholder_header_items(&headers, &header_names);
        if candidates.is_empty() {
            self.remove_internal_request_headers();
            return Action::Continue;
        }
        let request = RequestResolverRequest {
            credential_id: context.credential_id,
            adapter_id: context.adapter_id,
            target_host: context.target_host,
            target_path: context.target_path,
            header_value_prefix: context.header_value_prefix,
            origin: context.origin,
            request_headers: headers,
            simple_replacement_rules: request_rules,
            headers: candidates,
            allowed_header_names: header_names,
        };
        self.dispatch_request_call(encode_request_resolver_request(&request))
    }

    fn on_http_response_headers(&mut self, _: usize, _: bool) -> Action {
        let Some(context) = self.context.clone() else {
            return Action::Continue;
        };
        let response_names = simple_rule_header_names(&context.response_rules);
        if response_names.is_empty() {
            return Action::Continue;
        }
        let response_headers = response_header_map(&self.get_http_response_headers());
        let candidates = header_items(&response_headers, &response_names);
        if candidates.is_empty() {
            return Action::Continue;
        }
        let status_code = response_headers
            .get(":status")
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or_default();
        let request = ResponseResolverRequest {
            credential_id: context.credential_id,
            adapter_id: context.adapter_id,
            target_host: context.target_host,
            target_path: context.target_path,
            origin: context.origin,
            request_headers: context.request_headers,
            response_headers,
            simple_replacement_rules: context.response_rules,
            headers: candidates,
            allowed_header_names: response_names,
            status_code,
            header_value_prefix: context.header_value_prefix,
        };
        self.dispatch_response_call(encode_response_resolver_request(&request))
    }
}

impl ControlPlaneEgressAuthContext {
    fn dispatch_request_call(&mut self, body: Vec<u8>) -> Action {
        self.dispatch_call(
            body,
            self.config.request_method.clone(),
            CallPhase::RequestHeaders,
        )
    }

    fn dispatch_response_call(&mut self, body: Vec<u8>) -> Action {
        self.dispatch_call(
            body,
            self.config.response_method.clone(),
            CallPhase::ResponseHeaders,
        )
    }

    fn dispatch_call(&mut self, body: Vec<u8>, method: String, phase: CallPhase) -> Action {
        let timeout = Duration::from_millis(self.config.callout_timeout_millis);
        increment_metric(self.config.metrics.requests_total);
        match self.dispatch_grpc_call(
            &self.config.auth_service_cluster,
            &self.config.auth_service_name,
            &method,
            Vec::new(),
            Some(&body),
            timeout,
        ) {
            Ok(_) => {
                self.pending_call = Some(phase);
                Action::Pause
            }
            Err(_) => self.send_failure("control-plane egress auth service callout failed"),
        }
    }

    fn handle_auth_service_response(&mut self, status_code: u32, body_size: usize) {
        let phase = self
            .pending_call
            .take()
            .unwrap_or(CallPhase::RequestHeaders);
        if status_code != 0 {
            self.send_failure("control-plane egress auth replacement failed");
            return;
        }
        let Some(body) = self.get_grpc_call_response_body(0, body_size) else {
            self.send_failure("control-plane egress auth response read failed");
            return;
        };
        let Ok(response) = decode_resolver_response(&body) else {
            self.send_failure("control-plane egress auth response decoding failed");
            return;
        };
        if matches!(phase, CallPhase::RequestHeaders) {
            self.remove_internal_request_headers();
        }
        if response.skipped {
            self.remove_headers_for_phase(phase, response.remove_headers);
            increment_metric(self.config.metrics.skipped_total);
            self.resume_phase(phase);
            return;
        }
        if !response.error.trim().is_empty() || response.headers.is_empty() {
            self.send_failure("control-plane egress auth replacement failed");
            return;
        }
        for (name, value) in response.headers {
            let name = normalize_header_name(&name);
            if !name.is_empty() {
                self.set_header_for_phase(phase, &name, value.trim());
            }
        }
        self.remove_headers_for_phase(phase, response.remove_headers);
        increment_metric(self.config.metrics.success_total);
        self.resume_phase(phase);
    }

    fn remove_internal_request_headers(&self) {
        let headers = self.get_http_request_headers();
        for (name, _) in headers {
            let normalized = normalize_header_name(&name);
            if normalized.starts_with("x-code-code-") {
                self.remove_http_request_header(&normalized);
            }
        }
    }

    fn set_header_for_phase(&self, phase: CallPhase, name: &str, value: &str) {
        match phase {
            CallPhase::RequestHeaders => self.set_http_request_header(name, Some(value)),
            CallPhase::ResponseHeaders => self.set_http_response_header(name, Some(value)),
        }
    }

    fn remove_headers_for_phase(&self, phase: CallPhase, headers: Vec<String>) {
        for name in headers {
            let name = normalize_header_name(&name);
            if name.is_empty() {
                continue;
            }
            match phase {
                CallPhase::RequestHeaders => self.remove_http_request_header(&name),
                CallPhase::ResponseHeaders => self.remove_http_response_header(&name),
            }
        }
    }

    fn resume_phase(&self, phase: CallPhase) {
        match phase {
            CallPhase::RequestHeaders => self.resume_http_request(),
            CallPhase::ResponseHeaders => self.resume_http_response(),
        }
    }

    fn send_failure(&self, message: &str) -> Action {
        warn!("{message}");
        increment_metric(self.config.metrics.failure_total);
        self.send_http_response(
            502,
            vec![("content-type", "text/plain; charset=utf-8")],
            Some(b"control-plane egress auth replacement failed"),
        );
        Action::Pause
    }
}

struct RequestResolverRequest {
    credential_id: String,
    adapter_id: String,
    target_host: String,
    target_path: String,
    header_value_prefix: String,
    origin: String,
    request_headers: HashMap<String, String>,
    simple_replacement_rules: Vec<SimpleReplacementRule>,
    headers: Vec<HeaderReplacementItem>,
    allowed_header_names: Vec<String>,
}

struct ResponseResolverRequest {
    credential_id: String,
    adapter_id: String,
    target_host: String,
    target_path: String,
    origin: String,
    request_headers: HashMap<String, String>,
    response_headers: HashMap<String, String>,
    simple_replacement_rules: Vec<SimpleReplacementRule>,
    headers: Vec<HeaderReplacementItem>,
    allowed_header_names: Vec<String>,
    status_code: u32,
    header_value_prefix: String,
}

#[derive(Clone)]
struct HeaderReplacementItem {
    name: String,
    current_value: String,
}

#[derive(Clone, Default, Deserialize)]
#[serde(default)]
struct SimpleReplacementRule {
    mode: String,
    #[serde(alias = "headerName")]
    header_name: String,
    #[serde(alias = "materialKey")]
    material_key: String,
    #[serde(alias = "headerValuePrefix")]
    header_value_prefix: String,
    template: String,
}

#[derive(Default)]
struct ResolverResponse {
    headers: HashMap<String, String>,
    remove_headers: Vec<String>,
    error: String,
    skipped: bool,
}

fn define_metrics() -> Metrics {
    Metrics {
        requests_total: define_counter("code_code_control_plane_egress_auth_requests_total"),
        success_total: define_counter("code_code_control_plane_egress_auth_success_total"),
        failure_total: define_counter("code_code_control_plane_egress_auth_failure_total"),
        skipped_total: define_counter("code_code_control_plane_egress_auth_skipped_total"),
    }
}

fn define_counter(name: &str) -> u32 {
    hostcalls::define_metric(MetricType::Counter, name).unwrap_or_default()
}

fn increment_metric(metric_id: u32) {
    if metric_id != 0 {
        let _ = hostcalls::increment_metric(metric_id, 1);
    }
}

fn request_header_map(headers: &[(String, String)]) -> HashMap<String, String> {
    let mut values = HashMap::with_capacity(headers.len());
    for (name, value) in headers {
        let name = normalize_header_name(name);
        if !name.is_empty() {
            values.insert(name, value.trim().to_string());
        }
    }
    values
}

fn response_header_map(headers: &[(String, String)]) -> HashMap<String, String> {
    request_header_map(headers)
}

fn placeholder_header_items(
    headers: &HashMap<String, String>,
    names: &[String],
) -> Vec<HeaderReplacementItem> {
    let mut items = Vec::new();
    for name in names {
        let name = normalize_header_name(name);
        let value = trimmed_header(headers, &name);
        if !name.is_empty() && value.contains(PLACEHOLDER) {
            items.push(HeaderReplacementItem {
                name,
                current_value: value,
            });
        }
    }
    items
}

fn header_items(headers: &HashMap<String, String>, names: &[String]) -> Vec<HeaderReplacementItem> {
    let mut items = Vec::new();
    for name in names {
        let name = normalize_header_name(name);
        let value = trimmed_header(headers, &name);
        if !name.is_empty() && !value.is_empty() {
            items.push(HeaderReplacementItem {
                name,
                current_value: value,
            });
        }
    }
    items
}

fn parse_simple_rules(headers: &HashMap<String, String>, name: &str) -> Vec<SimpleReplacementRule> {
    let raw = trimmed_header(headers, name);
    if raw.is_empty() {
        return Vec::new();
    }
    serde_json::from_str::<Vec<SimpleReplacementRule>>(&raw).unwrap_or_default()
}

fn simple_rule_header_names(rules: &[SimpleReplacementRule]) -> Vec<String> {
    let mut names = Vec::new();
    for rule in rules {
        let name = normalize_header_name(&rule.header_name);
        if !name.is_empty() && !names.contains(&name) {
            names.push(name);
        }
    }
    names
}

fn split_header_list(value: Option<&String>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for field in value.split(|ch: char| ch == ',' || ch.is_whitespace()) {
        let field = normalize_header_name(field);
        if !field.is_empty() && !out.contains(&field) {
            out.push(field);
        }
    }
    out
}

fn first_non_empty(values: &[Option<&str>]) -> String {
    values
        .iter()
        .flatten()
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .unwrap_or_default()
        .to_string()
}

fn trimmed_header(headers: &HashMap<String, String>, name: &str) -> String {
    headers
        .get(&normalize_header_name(name))
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

fn normalize_header_name(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn encode_request_resolver_request(request: &RequestResolverRequest) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string_field(&mut out, 2, &request.credential_id);
    encode_string_field(&mut out, 3, &request.adapter_id);
    encode_string_field(&mut out, 4, &request.target_host);
    encode_string_field(&mut out, 5, &request.header_value_prefix);
    encode_string_field(&mut out, 6, &request.origin);
    for (key, value) in &request.request_headers {
        encode_string_map_entry(&mut out, 7, key, value);
    }
    encode_simple_rules(&mut out, 8, &request.simple_replacement_rules);
    encode_header_items(&mut out, 9, &request.headers);
    for name in &request.allowed_header_names {
        encode_string_field(&mut out, 10, name);
    }
    encode_string_field(&mut out, 12, &request.target_path);
    out
}

fn encode_response_resolver_request(request: &ResponseResolverRequest) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string_field(&mut out, 2, &request.credential_id);
    encode_string_field(&mut out, 3, &request.adapter_id);
    encode_string_field(&mut out, 4, &request.target_host);
    encode_string_field(&mut out, 5, &request.origin);
    for (key, value) in &request.request_headers {
        encode_string_map_entry(&mut out, 6, key, value);
    }
    for (key, value) in &request.response_headers {
        encode_string_map_entry(&mut out, 7, key, value);
    }
    encode_simple_rules(&mut out, 8, &request.simple_replacement_rules);
    encode_header_items(&mut out, 9, &request.headers);
    for name in &request.allowed_header_names {
        encode_string_field(&mut out, 10, name);
    }
    encode_string_field(&mut out, 12, &request.target_path);
    if request.status_code != 0 {
        encode_key(&mut out, 13, 0);
        encode_varint(&mut out, request.status_code as u64);
    }
    encode_string_field(&mut out, 14, &request.header_value_prefix);
    out
}

fn encode_simple_rules(out: &mut Vec<u8>, field: u64, rules: &[SimpleReplacementRule]) {
    for rule in rules {
        let mut message = Vec::new();
        encode_string_field(&mut message, 1, &rule.mode);
        encode_string_field(&mut message, 2, &rule.header_name);
        encode_string_field(&mut message, 3, &rule.material_key);
        encode_string_field(&mut message, 4, &rule.header_value_prefix);
        encode_string_field(&mut message, 5, &rule.template);
        encode_message_field(out, field, &message);
    }
}

fn encode_header_items(out: &mut Vec<u8>, field: u64, items: &[HeaderReplacementItem]) {
    for item in items {
        let mut message = Vec::new();
        encode_string_field(&mut message, 1, &item.name);
        encode_string_field(&mut message, 2, &item.current_value);
        encode_message_field(out, field, &message);
    }
}

fn encode_string_map_entry(out: &mut Vec<u8>, field: u64, key: &str, value: &str) {
    let mut entry = Vec::new();
    encode_string_field(&mut entry, 1, key);
    encode_string_field(&mut entry, 2, value);
    encode_message_field(out, field, &entry);
}

fn decode_resolver_response(bytes: &[u8]) -> Result<ResolverResponse, ()> {
    let mut response = ResolverResponse::default();
    let mut index = 0;
    while index < bytes.len() {
        let key = read_varint(bytes, &mut index)?;
        let field = key >> 3;
        let wire = key & 0x07;
        match (field, wire) {
            (1, 2) => {
                let entry = read_length_delimited(bytes, &mut index)?;
                if let Some((key, value)) = decode_string_map_entry(entry)? {
                    response.headers.insert(key, value);
                }
            }
            (2, 2) => response
                .remove_headers
                .push(read_string(bytes, &mut index)?),
            (3, 2) => response.error = read_string(bytes, &mut index)?,
            (4, 0) => response.skipped = read_varint(bytes, &mut index)? != 0,
            _ => skip_field(bytes, &mut index, wire)?,
        }
    }
    Ok(response)
}

fn decode_string_map_entry(bytes: &[u8]) -> Result<Option<(String, String)>, ()> {
    let mut key = String::new();
    let mut value = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let tag = read_varint(bytes, &mut index)?;
        let field = tag >> 3;
        let wire = tag & 0x07;
        match (field, wire) {
            (1, 2) => key = read_string(bytes, &mut index)?,
            (2, 2) => value = read_string(bytes, &mut index)?,
            _ => skip_field(bytes, &mut index, wire)?,
        }
    }
    if key.is_empty() {
        return Ok(None);
    }
    Ok(Some((key, value)))
}

fn encode_string_field(out: &mut Vec<u8>, field: u64, value: &str) {
    if value.is_empty() {
        return;
    }
    encode_key(out, field, 2);
    encode_varint(out, value.len() as u64);
    out.extend_from_slice(value.as_bytes());
}

fn encode_message_field(out: &mut Vec<u8>, field: u64, value: &[u8]) {
    encode_key(out, field, 2);
    encode_varint(out, value.len() as u64);
    out.extend_from_slice(value);
}

fn encode_key(out: &mut Vec<u8>, field: u64, wire: u64) {
    encode_varint(out, (field << 3) | wire);
}

fn encode_varint(out: &mut Vec<u8>, mut value: u64) {
    while value >= 0x80 {
        out.push((value as u8) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn read_varint(bytes: &[u8], index: &mut usize) -> Result<u64, ()> {
    let mut shift = 0;
    let mut value = 0u64;
    while *index < bytes.len() && shift < 64 {
        let byte = bytes[*index];
        *index += 1;
        value |= ((byte & 0x7f) as u64) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
        shift += 7;
    }
    Err(())
}

fn read_string(bytes: &[u8], index: &mut usize) -> Result<String, ()> {
    let raw = read_length_delimited(bytes, index)?;
    String::from_utf8(raw.to_vec()).map_err(|_| ())
}

fn read_length_delimited<'a>(bytes: &'a [u8], index: &mut usize) -> Result<&'a [u8], ()> {
    let len = read_varint(bytes, index)? as usize;
    if *index + len > bytes.len() {
        return Err(());
    }
    let start = *index;
    *index += len;
    Ok(&bytes[start..start + len])
}

fn skip_field(bytes: &[u8], index: &mut usize, wire: u64) -> Result<(), ()> {
    match wire {
        0 => {
            let _ = read_varint(bytes, index)?;
            Ok(())
        }
        1 => {
            *index = (*index).checked_add(8).ok_or(())?;
            if *index > bytes.len() {
                return Err(());
            }
            Ok(())
        }
        2 => {
            let _ = read_length_delimited(bytes, index)?;
            Ok(())
        }
        5 => {
            *index = (*index).checked_add(4).ok_or(())?;
            if *index > bytes.len() {
                return Err(());
            }
            Ok(())
        }
        _ => Err(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_rule_header_names_requires_explicit_header_names() {
        let rules = vec![
            SimpleReplacementRule {
                mode: "bearer".to_string(),
                ..SimpleReplacementRule::default()
            },
            SimpleReplacementRule {
                mode: "cookie".to_string(),
                header_name: "set-cookie".to_string(),
                ..SimpleReplacementRule::default()
            },
        ];
        assert_eq!(
            simple_rule_header_names(&rules),
            vec!["set-cookie".to_string()]
        );
    }

    #[test]
    fn protobuf_response_decoder_reads_headers_and_removals() {
        let mut body = Vec::new();
        let mut entry = Vec::new();
        encode_string_field(&mut entry, 1, "set-cookie");
        encode_string_field(&mut entry, 2, "SID=PLACEHOLDER");
        encode_message_field(&mut body, 1, &entry);
        encode_string_field(&mut body, 2, "x-remove-me");
        let response = decode_resolver_response(&body).unwrap();
        assert_eq!(response.headers["set-cookie"], "SID=PLACEHOLDER");
        assert_eq!(response.remove_headers, vec!["x-remove-me".to_string()]);
    }
}
