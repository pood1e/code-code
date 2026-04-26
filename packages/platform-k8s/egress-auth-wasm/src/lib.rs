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
const DEFAULT_AGENT_SESSION_CLUSTER: &str =
    "outbound|8081||platform-agent-runtime-service.code-code.svc.cluster.local";
const DEFAULT_AGENT_SESSION_NAME: &str = "platform.management.v1.AgentSessionManagementService";
const DEFAULT_RESPONSE_HEADERS_RECORD_METHOD: &str = "RecordAgentRunResponseHeaders";
const DEFAULT_CALLOUT_TIMEOUT_MILLIS: u64 = 3000;
const GRPC_STATUS_NOT_FOUND: u32 = 5;
const DEFAULT_RUNTIME_NAMESPACE: &str = "code-code-runs";

proxy_wasm::main! {{
    proxy_wasm::set_log_level(LogLevel::Info);
    proxy_wasm::set_root_context(|_| -> Box<dyn RootContext> {
        Box::new(EgressAuthRoot {
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
    agent_session_cluster: String,
    agent_session_name: String,
    response_headers_record_method: String,
    callout_timeout_millis: u64,
    require_runtime_source: bool,
    runtime_namespace: String,
    metrics: Metrics,
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            auth_service_cluster: DEFAULT_AUTH_SERVICE_CLUSTER.to_string(),
            auth_service_name: DEFAULT_AUTH_SERVICE_NAME.to_string(),
            request_method: DEFAULT_REQUEST_METHOD.to_string(),
            response_method: DEFAULT_RESPONSE_METHOD.to_string(),
            agent_session_cluster: DEFAULT_AGENT_SESSION_CLUSTER.to_string(),
            agent_session_name: DEFAULT_AGENT_SESSION_NAME.to_string(),
            response_headers_record_method: DEFAULT_RESPONSE_HEADERS_RECORD_METHOD.to_string(),
            callout_timeout_millis: DEFAULT_CALLOUT_TIMEOUT_MILLIS,
            require_runtime_source: true,
            runtime_namespace: DEFAULT_RUNTIME_NAMESPACE.to_string(),
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
    #[serde(alias = "agentSessionCluster")]
    agent_session_cluster: String,
    #[serde(alias = "agentSessionName")]
    agent_session_name: String,
    #[serde(alias = "responseHeadersRecordMethod")]
    response_headers_record_method: String,
    #[serde(alias = "timeoutMilliseconds")]
    timeout_milliseconds: u64,
    #[serde(alias = "requireRuntimeContext")]
    require_runtime_context: Option<bool>,
    #[serde(alias = "requireRuntimeSource")]
    require_runtime_source: Option<bool>,
    #[serde(alias = "runtimeNamespace")]
    runtime_namespace: String,
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
        if !self.agent_session_cluster.trim().is_empty() {
            config.agent_session_cluster = self.agent_session_cluster.trim().to_string();
        }
        if !self.agent_session_name.trim().is_empty() {
            config.agent_session_name = self.agent_session_name.trim().to_string();
        }
        if !self.response_headers_record_method.trim().is_empty() {
            config.response_headers_record_method =
                self.response_headers_record_method.trim().to_string();
        }
        if self.timeout_milliseconds > 0 {
            config.callout_timeout_millis = self.timeout_milliseconds;
        }
        if let Some(require_runtime_source) =
            self.require_runtime_source.or(self.require_runtime_context)
        {
            config.require_runtime_source = require_runtime_source;
        }
        if !self.runtime_namespace.trim().is_empty() {
            config.runtime_namespace = self.runtime_namespace.trim().to_string();
        }
        config
    }
}

struct EgressAuthRoot {
    config: PluginConfig,
}

impl Context for EgressAuthRoot {}

impl RootContext for EgressAuthRoot {
    fn on_configure(&mut self, plugin_configuration_size: usize) -> bool {
        let mut config = PluginConfig::default();
        if plugin_configuration_size > 0 {
            let Some(raw) = self.get_plugin_configuration() else {
                warn!("agent egress auth wasm: read plugin config failed");
                return false;
            };
            let Ok(parsed) = serde_json::from_slice::<RawPluginConfig>(&raw) else {
                warn!("agent egress auth wasm: parse plugin config failed");
                return false;
            };
            config = parsed.merge(config);
        }
        config.metrics = define_metrics();
        self.config = config;
        true
    }

    fn create_http_context(&self, _: u32) -> Option<Box<dyn HttpContext>> {
        Some(Box::new(EgressAuthContext {
            config: self.config.clone(),
            runtime_source: RuntimeSource::None,
            target_host: String::new(),
            target_path: String::new(),
            response_headers_for_record: HashMap::new(),
            response_status_code: 0,
            pending_call: None,
        }))
    }

    fn get_type(&self) -> Option<ContextType> {
        Some(ContextType::HttpContext)
    }
}

struct EgressAuthContext {
    config: PluginConfig,
    runtime_source: RuntimeSource,
    target_host: String,
    target_path: String,
    response_headers_for_record: HashMap<String, String>,
    response_status_code: u32,
    pending_call: Option<CallPhase>,
}

#[derive(Clone, Copy)]
enum CallPhase {
    RequestHeaders,
    ResponseHeaders,
    ResponseHeaderMetrics,
}

impl Context for EgressAuthContext {
    fn on_grpc_call_response(&mut self, _: u32, status_code: u32, body_size: usize) {
        self.handle_auth_service_response(status_code, body_size);
    }
}

impl HttpContext for EgressAuthContext {
    fn on_http_request_headers(&mut self, _: usize, _: bool) -> Action {
        let headers = self.get_http_request_headers();
        let request_headers = request_header_map(&headers);
        let authority = first_non_empty(&[
            request_headers.get(":authority").map(String::as_str),
            request_headers.get("host").map(String::as_str),
        ]);
        let target_path = trimmed_header(&request_headers, ":path");
        let runtime_source = self.runtime_source(&request_headers);
        if runtime_source.is_none() {
            increment_metric(self.config.metrics.skipped_total);
            return Action::Continue;
        }
        self.runtime_source = runtime_source.clone();
        self.target_host = authority.clone();
        self.target_path = target_path.clone();
        let request = ResolverRequest {
            credential_id: String::new(),
            adapter_id: String::new(),
            target_host: authority,
            target_path,
            header_value_prefix: String::new(),
            origin: String::new(),
            request_headers: HashMap::new(),
            headers: Vec::new(),
            allowed_header_names: Vec::new(),
            runtime_source,
        };
        let body = encode_resolver_request(&request);
        let timeout = Duration::from_millis(self.config.callout_timeout_millis);
        increment_metric(self.config.metrics.requests_total);
        match self.dispatch_grpc_call(
            &self.config.auth_service_cluster,
            &self.config.auth_service_name,
            &self.config.request_method,
            Vec::new(),
            Some(&body),
            timeout,
        ) {
            Ok(_) => {
                self.pending_call = Some(CallPhase::RequestHeaders);
                Action::Pause
            }
            Err(_) => self.send_failure("agent egress auth service callout failed"),
        }
    }

    fn on_http_response_headers(&mut self, _: usize, _: bool) -> Action {
        if self.config.require_runtime_source && self.runtime_source.is_none() {
            return Action::Continue;
        }
        let response_headers = response_header_map(&self.get_http_response_headers());
        let status_code = response_headers
            .get(":status")
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or_default();
        self.response_headers_for_record = response_headers.clone();
        self.response_status_code = status_code;
        let request = ResponseResolverRequest {
            credential_id: String::new(),
            adapter_id: String::new(),
            target_host: self.target_host.clone(),
            target_path: self.target_path.clone(),
            origin: String::new(),
            request_headers: HashMap::new(),
            response_headers,
            headers: Vec::new(),
            allowed_header_names: Vec::new(),
            runtime_source: self.runtime_source.clone(),
            status_code,
            header_value_prefix: String::new(),
        };
        let body = encode_response_resolver_request(&request);
        let timeout = Duration::from_millis(self.config.callout_timeout_millis);
        increment_metric(self.config.metrics.requests_total);
        match self.dispatch_grpc_call(
            &self.config.auth_service_cluster,
            &self.config.auth_service_name,
            &self.config.response_method,
            Vec::new(),
            Some(&body),
            timeout,
        ) {
            Ok(_) => {
                self.pending_call = Some(CallPhase::ResponseHeaders);
                Action::Pause
            }
            Err(_) => self.send_failure("agent egress auth response service callout failed"),
        }
    }
}

impl EgressAuthContext {
    fn runtime_source(&self, _: &HashMap<String, String>) -> RuntimeSource {
        if !self.config.runtime_namespace.trim().is_empty() {
            let namespace = source_property_string(self.get_property(vec!["source", "namespace"]));
            let principal = source_property_string(self.get_property(vec!["source", "principal"]));
            if !source_matches_runtime_namespace(
                &namespace,
                &principal,
                &self.config.runtime_namespace,
            ) {
                return RuntimeSource::None;
            }
        }
        let source_ip = source_ip_from_property(self.get_property(vec!["source", "address"]));
        if !source_ip.is_empty() {
            return RuntimeSource::PodIp(source_ip);
        }
        RuntimeSource::None
    }

    fn handle_auth_service_response(&mut self, status_code: u32, body_size: usize) {
        let phase = self
            .pending_call
            .take()
            .unwrap_or(CallPhase::RequestHeaders);
        if matches!(phase, CallPhase::ResponseHeaderMetrics) {
            if status_code != 0 {
                warn!("agent egress response header metric record failed");
                increment_metric(self.config.metrics.failure_total);
            } else {
                increment_metric(self.config.metrics.success_total);
            }
            self.resume_http_response();
            return;
        }
        if status_code != 0 {
            if status_code == GRPC_STATUS_NOT_FOUND {
                increment_metric(self.config.metrics.skipped_total);
                self.resume_phase(phase);
                return;
            }
            self.send_failure("agent egress auth replacement failed");
            return;
        }
        let Some(body) = self.get_grpc_call_response_body(0, body_size) else {
            self.send_failure("agent egress auth response read failed");
            return;
        };
        let Ok(response) = decode_resolver_response(&body) else {
            self.send_failure("agent egress auth response decoding failed");
            return;
        };
        if response.skipped {
            self.remove_headers_for_phase(phase, response.remove_headers);
            increment_metric(self.config.metrics.skipped_total);
            if !self.dispatch_response_header_metric_record() {
                self.resume_phase(phase);
            }
            return;
        }
        if !response.error.trim().is_empty() || response.headers.is_empty() {
            self.send_failure("agent egress auth replacement failed");
            return;
        }
        for (name, value) in response.headers {
            let name = normalize_header_name(&name);
            if !name.is_empty() {
                self.set_header_for_phase(phase, &name, value.trim());
            }
        }
        for name in response.remove_headers {
            self.remove_header_for_phase(phase, &name);
        }
        increment_metric(self.config.metrics.success_total);
        if !self.dispatch_response_header_metric_record() {
            self.resume_phase(phase);
        }
    }

    fn send_failure(&self, message: &str) -> Action {
        warn!("{message}");
        increment_metric(self.config.metrics.failure_total);
        self.send_http_response(
            502,
            vec![("content-type", "text/plain; charset=utf-8")],
            Some(b"agent egress auth replacement failed"),
        );
        Action::Pause
    }

    fn remove_headers_for_phase(&self, phase: CallPhase, headers: Vec<String>) {
        for name in headers {
            self.remove_header_for_phase(phase, &name);
        }
    }

    fn set_header_for_phase(&self, phase: CallPhase, name: &str, value: &str) {
        match phase {
            CallPhase::RequestHeaders => self.set_http_request_header(name, Some(value)),
            CallPhase::ResponseHeaders => self.set_http_response_header(name, Some(value)),
            CallPhase::ResponseHeaderMetrics => {}
        }
    }

    fn remove_header_for_phase(&self, phase: CallPhase, name: &str) {
        let name = normalize_header_name(name);
        if !name.is_empty() {
            match phase {
                CallPhase::RequestHeaders => self.remove_http_request_header(&name),
                CallPhase::ResponseHeaders => self.remove_http_response_header(&name),
                CallPhase::ResponseHeaderMetrics => {}
            }
        }
    }

    fn resume_phase(&self, phase: CallPhase) {
        match phase {
            CallPhase::RequestHeaders => self.resume_http_request(),
            CallPhase::ResponseHeaders => self.resume_http_response(),
            CallPhase::ResponseHeaderMetrics => self.resume_http_response(),
        }
    }

    fn dispatch_response_header_metric_record(&mut self) -> bool {
        if self.runtime_source.is_none() || self.response_headers_for_record.is_empty() {
            return false;
        }
        let request = ResponseHeaderMetricRecordRequest {
            target_host: self.target_host.clone(),
            target_path: self.target_path.clone(),
            status_code: self.response_status_code,
            response_headers: self.response_headers_for_record.clone(),
            runtime_source: self.runtime_source.clone(),
        };
        let body = encode_response_header_metric_record_request(&request);
        let timeout = Duration::from_millis(self.config.callout_timeout_millis);
        match self.dispatch_grpc_call(
            &self.config.agent_session_cluster,
            &self.config.agent_session_name,
            &self.config.response_headers_record_method,
            Vec::new(),
            Some(&body),
            timeout,
        ) {
            Ok(_) => {
                self.pending_call = Some(CallPhase::ResponseHeaderMetrics);
                true
            }
            Err(_) => {
                warn!("agent egress response header metric record callout failed");
                false
            }
        }
    }
}

struct ResolverRequest {
    credential_id: String,
    adapter_id: String,
    target_host: String,
    target_path: String,
    header_value_prefix: String,
    origin: String,
    request_headers: HashMap<String, String>,
    headers: Vec<HeaderReplacementItem>,
    allowed_header_names: Vec<String>,
    runtime_source: RuntimeSource,
}

struct ResponseResolverRequest {
    credential_id: String,
    adapter_id: String,
    target_host: String,
    target_path: String,
    origin: String,
    request_headers: HashMap<String, String>,
    response_headers: HashMap<String, String>,
    headers: Vec<HeaderReplacementItem>,
    allowed_header_names: Vec<String>,
    runtime_source: RuntimeSource,
    status_code: u32,
    header_value_prefix: String,
}

struct ResponseHeaderMetricRecordRequest {
    target_host: String,
    target_path: String,
    status_code: u32,
    response_headers: HashMap<String, String>,
    runtime_source: RuntimeSource,
}

#[derive(Clone)]
enum RuntimeSource {
    None,
    PodIp(String),
}

impl RuntimeSource {
    fn is_none(&self) -> bool {
        matches!(self, RuntimeSource::None)
    }
}

#[derive(Clone)]
struct HeaderReplacementItem {
    name: String,
    current_value: String,
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
        requests_total: define_counter("code_code_agent_egress_auth_requests_total"),
        success_total: define_counter("code_code_agent_egress_auth_success_total"),
        failure_total: define_counter("code_code_agent_egress_auth_failure_total"),
        skipped_total: define_counter("code_code_agent_egress_auth_skipped_total"),
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

fn source_ip_from_property(value: Option<Vec<u8>>) -> String {
    normalize_source_ip(&source_property_string(value))
}

fn source_property_string(value: Option<Vec<u8>>) -> String {
    let Some(value) = value else {
        return String::new();
    };
    let Ok(value) = String::from_utf8(value) else {
        return String::new();
    };
    value.trim().to_string()
}

fn source_matches_runtime_namespace(
    namespace: &str,
    principal: &str,
    runtime_namespace: &str,
) -> bool {
    let runtime_namespace = runtime_namespace.trim();
    if runtime_namespace.is_empty() {
        return true;
    }
    if namespace.trim() == runtime_namespace {
        return true;
    }
    let principal = principal.trim();
    !principal.is_empty() && principal.contains(&format!("/ns/{runtime_namespace}/"))
}

fn normalize_source_ip(value: &str) -> String {
    let mut value = value.trim();
    if let Some(stripped) = value.strip_prefix("tcp://") {
        value = stripped;
    }
    if let Some(stripped) = value.strip_prefix("udp://") {
        value = stripped;
    }
    if let Some(stripped) = value.strip_prefix('[') {
        if let Some(index) = stripped.find(']') {
            return stripped[..index].trim().to_string();
        }
    }
    if let Some(index) = value.rfind(':') {
        if index > 0 && !value[..index].contains(':') {
            value = &value[..index];
        }
    }
    value.trim_matches(['[', ']']).to_string()
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
        .get(name)
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

fn normalize_header_name(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn encode_resolver_request(request: &ResolverRequest) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string_field(&mut out, 2, &request.credential_id);
    encode_string_field(&mut out, 3, &request.adapter_id);
    encode_string_field(&mut out, 4, &request.target_host);
    encode_string_field(&mut out, 5, &request.header_value_prefix);
    encode_string_field(&mut out, 6, &request.origin);
    for (key, value) in &request.request_headers {
        let mut entry = Vec::new();
        encode_string_field(&mut entry, 1, key);
        encode_string_field(&mut entry, 2, value);
        encode_message_field(&mut out, 7, &entry);
    }
    for item in &request.headers {
        let mut message = Vec::new();
        encode_string_field(&mut message, 1, &item.name);
        encode_string_field(&mut message, 2, &item.current_value);
        encode_message_field(&mut out, 9, &message);
    }
    for name in &request.allowed_header_names {
        encode_string_field(&mut out, 10, name);
    }
    encode_runtime_source(&mut out, &request.runtime_source);
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
    for item in &request.headers {
        let mut message = Vec::new();
        encode_string_field(&mut message, 1, &item.name);
        encode_string_field(&mut message, 2, &item.current_value);
        encode_message_field(&mut out, 9, &message);
    }
    for name in &request.allowed_header_names {
        encode_string_field(&mut out, 10, name);
    }
    encode_runtime_source(&mut out, &request.runtime_source);
    encode_string_field(&mut out, 12, &request.target_path);
    if request.status_code != 0 {
        encode_key(&mut out, 13, 0);
        encode_varint(&mut out, request.status_code as u64);
    }
    encode_string_field(&mut out, 14, &request.header_value_prefix);
    out
}

fn encode_response_header_metric_record_request(
    request: &ResponseHeaderMetricRecordRequest,
) -> Vec<u8> {
    let mut out = Vec::new();
    encode_management_runtime_source(&mut out, &request.runtime_source);
    encode_string_field(&mut out, 4, &request.target_host);
    encode_string_field(&mut out, 5, &request.target_path);
    if request.status_code != 0 {
        encode_key(&mut out, 6, 0);
        encode_varint(&mut out, request.status_code as u64);
    }
    for (key, value) in &request.response_headers {
        encode_string_map_entry(&mut out, 7, key, value);
    }
    out
}

fn encode_management_runtime_source(out: &mut Vec<u8>, source: &RuntimeSource) {
    match source {
        RuntimeSource::None => {}
        RuntimeSource::PodIp(ip) => {
            let mut pod = Vec::new();
            encode_string_field(&mut pod, 4, ip);
            encode_message_field(out, 2, &pod);
        }
    }
}

fn encode_string_map_entry(out: &mut Vec<u8>, field: u64, key: &str, value: &str) {
    let mut entry = Vec::new();
    encode_string_field(&mut entry, 1, key);
    encode_string_field(&mut entry, 2, value);
    encode_message_field(out, field, &entry);
}

fn encode_runtime_source(out: &mut Vec<u8>, source: &RuntimeSource) {
    let mut message = Vec::new();
    match source {
        RuntimeSource::None => return,
        RuntimeSource::PodIp(ip) => {
            let mut pod = Vec::new();
            encode_string_field(&mut pod, 4, ip);
            encode_message_field(&mut message, 1, &pod);
        }
    }
    encode_message_field(out, 11, &message);
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
    fn source_ip_parser_handles_envoy_address_shapes() {
        assert_eq!(
            source_ip_from_property(Some(b"10.0.0.12:53422".to_vec())),
            "10.0.0.12"
        );
        assert_eq!(
            source_ip_from_property(Some(b"tcp://[fd00::1]:53422".to_vec())),
            "fd00::1"
        );
    }

    #[test]
    fn runtime_namespace_filter_matches_namespace_or_principal() {
        assert!(source_matches_runtime_namespace(
            "code-code-runs",
            "",
            "code-code-runs"
        ));
        assert!(source_matches_runtime_namespace(
            "",
            "spiffe://cluster.local/ns/code-code-runs/sa/default",
            "code-code-runs"
        ));
        assert!(!source_matches_runtime_namespace(
            "code-code",
            "spiffe://cluster.local/ns/code-code/sa/platform-auth-service",
            "code-code-runs"
        ));
        assert!(!source_matches_runtime_namespace("", "", "code-code-runs"));
    }

    #[test]
    fn protobuf_response_decoder_reads_headers_and_removals() {
        let mut body = Vec::new();
        let mut entry = Vec::new();
        encode_string_field(&mut entry, 1, "x-test-header");
        encode_string_field(&mut entry, 2, "test-value");
        encode_message_field(&mut body, 1, &entry);
        encode_string_field(&mut body, 2, "x-remove-me");
        let response = decode_resolver_response(&body).unwrap();
        assert_eq!(response.headers["x-test-header"], "test-value");
        assert_eq!(response.remove_headers, vec!["x-remove-me".to_string()]);
    }

    #[test]
    fn protobuf_response_decoder_reads_skipped_flag() {
        let mut body = Vec::new();
        encode_key(&mut body, 4, 0);
        encode_varint(&mut body, 1);
        let response = decode_resolver_response(&body).unwrap();
        assert!(response.skipped);
    }
}
