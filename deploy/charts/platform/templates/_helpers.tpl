{{- define "platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "platform.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "platform.labels" -}}
helm.sh/chart: {{ include "platform.chart" .root }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: {{ .root.Values.global.partOf }}
{{ include "platform.selectorLabels" . }}
{{- if .componentLabel }}
app.kubernetes.io/component: {{ .componentLabel }}
{{- end }}
app.kubernetes.io/version: {{ default .root.Values.global.imageTag .imageTag | quote }}
{{- end -}}

{{- define "platform.image" -}}
{{- $registry := trimSuffix "/" (default .root.Values.global.imageRegistry .imageRegistry) -}}
{{- $tag := default (default .root.Chart.AppVersion .root.Values.global.imageTag) .imageTag -}}
{{- if $registry -}}
{{- printf "%s/code-code/%s:%s" $registry .imageName $tag -}}
{{- else -}}
{{- printf "code-code/%s:%s" .imageName $tag -}}
{{- end -}}
{{- end -}}

{{- define "platform.serviceAccountName" -}}
{{- $serviceAccount := .component.serviceAccount | default dict -}}
{{- if or $serviceAccount.create $serviceAccount.name -}}
{{- default .component.name $serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "platform.componentNamespace" -}}
{{- if hasKey .component "namespaceTpl" -}}
{{- tpl .component.namespaceTpl .root -}}
{{- else -}}
{{- default .root.Release.Namespace .component.namespace -}}
{{- end -}}
{{- end -}}

{{- define "platform.egressServiceNamespace" -}}
{{- include "platform.componentNamespace" (dict "root" . "component" .Values.components.egress) -}}
{{- end -}}

{{- define "platform.egressServiceAddress" -}}
{{- printf "%s.%s.svc.cluster.local:8081" .Values.components.egress.name (include "platform.egressServiceNamespace" . | trim) -}}
{{- end -}}

{{- define "platform.renderEnv" -}}
{{- $root := .root -}}
{{- $component := .component | default dict -}}
{{- $env := deepCopy (.env | default dict) -}}
{{- if .databaseUrl }}
{{- $_ := set $env "PLATFORM_DATABASE_URL" (dict "valueFrom" (dict "secretKeyRef" (dict "key" $root.Values.global.databaseSecretKey "name" $root.Values.global.databaseSecretName))) -}}
{{- end }}
{{- if .credentialEncryptionKey }}
{{- $_ := set $env "PLATFORM_CREDENTIAL_ENCRYPTION_KEY" (dict "valueFrom" (dict "secretKeyRef" (dict "key" $root.Values.global.credentialEncryptionSecretKey "name" $root.Values.global.credentialEncryptionSecretName))) -}}
{{- $_ := set $env "PLATFORM_CREDENTIAL_ENCRYPTION_KEY_ID" (dict "value" $root.Values.global.credentialEncryptionKeyId) -}}
{{- end }}
{{- if .internalActionToken }}
{{- $tokenEnvName := printf "PLATFORM_%s_INTERNAL_ACTION_TOKEN" (trimPrefix "platform-" $component.name | replace "-" "_" | upper) -}}
{{- $_ := set $env $tokenEnvName (dict "valueFrom" (dict "secretKeyRef" (dict "key" "token" "name" (printf "%s-internal-action" $component.name) "optional" true))) -}}
{{- end }}
{{- if .egressTrustBundle }}
{{- $trustBundleFile := "/var/run/code-code-egress-trust/ca-certificates.crt" -}}
{{- $_ := set $env "CURL_CA_BUNDLE" (dict "value" $trustBundleFile) -}}
{{- $_ := set $env "GIT_SSL_CAINFO" (dict "value" $trustBundleFile) -}}
{{- $_ := set $env "NODE_EXTRA_CA_CERTS" (dict "value" $trustBundleFile) -}}
{{- $_ := set $env "REQUESTS_CA_BUNDLE" (dict "value" $trustBundleFile) -}}
{{- $_ := set $env "SSL_CERT_FILE" (dict "value" $trustBundleFile) -}}
{{- end }}
{{- range $name := keys $env | sortAlpha }}
{{- $spec := index $env $name }}
- name: {{ $name }}
  {{- if hasKey $spec "valueFrom" }}
  valueFrom:
{{ toYaml $spec.valueFrom | nindent 4 }}
  {{- else if hasKey $spec "valueTpl" }}
  value: {{ tpl $spec.valueTpl $root | quote }}
  {{- else }}
  value: {{ $spec.value | default "" | quote }}
  {{- end }}
{{- end -}}
{{- end -}}

{{- define "platform.renderContainerPorts" -}}
{{- $ports := deepCopy (.ports | default dict) -}}
{{- if and .portPreset (empty $ports) }}
{{- $ports = include "platform.portPreset" (dict "preset" .portPreset) | fromYaml -}}
{{- end }}
{{- range $name := keys $ports | sortAlpha }}
- name: {{ $name }}
  containerPort: {{ int (index $ports $name) }}
{{- end -}}
{{- end -}}

{{- define "platform.renderServicePorts" -}}
{{- $service := .service -}}
{{- $ports := deepCopy ($service.ports | default dict) -}}
{{- if and .portPreset (empty $ports) }}
{{- $ports = include "platform.portPreset" (dict "preset" .portPreset) | fromYaml -}}
{{- end }}
{{- $targetPorts := $service.targetPorts | default dict -}}
{{- range $name := keys $ports | sortAlpha }}
- name: {{ $name }}
  port: {{ int (index $ports $name) }}
  targetPort: {{ default $name (index $targetPorts $name) }}
{{- end -}}
{{- end -}}

{{- define "platform.servicePort" -}}
{{- $component := .component -}}
{{- $ports := deepCopy ($component.service.ports | default dict) -}}
{{- if and $component.portPreset (empty $ports) }}
{{- $ports = include "platform.portPreset" (dict "preset" $component.portPreset) | fromYaml -}}
{{- end }}
{{- index $ports .name -}}
{{- end -}}

{{/* Return the standard service/container port map for platform components. */}}
{{- define "platform.portPreset" -}}
{{- if eq .preset "grpc-http" -}}
grpc: 8081
http: 8080
{{- else if eq .preset "grpc" -}}
grpc: 8081
{{- else if eq .preset "http" -}}
http: 8080
{{- else -}}
{{- fail (printf "unknown portPreset %q" .preset) -}}
{{- end -}}
{{- end -}}

{{- define "platform.renderVolumeMounts" -}}
{{- $mounts := deepCopy (.mounts | default dict) -}}
{{- if .egressTrustBundle }}
{{- $_ := set $mounts "egressTrustBundle" (dict "name" "egress-trust-bundle" "mountPath" "/var/run/code-code-egress-trust" "readOnly" true) -}}
{{- end }}
{{- range $key := keys $mounts | sortAlpha }}
{{- $mount := index $mounts $key }}
- name: {{ default $key $mount.name }}
  mountPath: {{ $mount.mountPath }}
  {{- if hasKey $mount "readOnly" }}
  readOnly: {{ $mount.readOnly }}
  {{- end }}
{{- end -}}
{{- end -}}

{{- define "platform.renderVolumes" -}}
{{- $root := .root -}}
{{- $volumes := deepCopy (.volumes | default dict) -}}
{{- if .egressTrustBundle }}
{{- $_ := set $volumes "egressTrustBundle" (dict "name" "egress-trust-bundle" "configMap" (dict "name" $root.Values.global.trustBundleConfigMapName)) -}}
{{- end }}
{{- range $key := keys $volumes | sortAlpha }}
{{- $volume := index $volumes $key }}
- name: {{ default $key $volume.name }}
{{ toYaml (omit $volume "name") | nindent 2 }}
{{- end -}}
{{- end -}}

{{- define "platform.renderHttpRoute" -}}
{{- $root := .root -}}
{{- $route := .route -}}
{{- $hosts := list $route.host -}}
{{- range $extra := $route.extraHosts }}
{{- $hosts = append $hosts $extra -}}
{{- end }}
{{- $hosts = uniq $hosts -}}
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .name }}
  namespace: {{ .namespace }}
  labels:
{{ include "platform.labels" (dict "root" $root "name" .name "componentLabel" "ingress") | nindent 4 }}
spec:
  parentRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: {{ $route.parentRef.name }}
      namespace: {{ $route.parentRef.namespace }}
      sectionName: {{ $route.parentRef.sectionName }}
  hostnames:
{{- range $host := $hosts }}
    - {{ $host | quote }}
{{- end }}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: {{ .apiComponent.name }}
          port: {{ include "platform.servicePort" (dict "component" .apiComponent "name" "http") }}
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ .webComponent.name }}
          port: {{ include "platform.servicePort" (dict "component" .webComponent "name" "http") }}
{{- end -}}

{{/* Return standard Kubernetes startup/readiness/liveness probes. */}}
{{- define "platform.probePreset" -}}
{{- $preset := .preset -}}
{{- if eq $preset "grpc-8081" -}}
startupProbe:
  grpc:
    port: 8081
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 72
readinessProbe:
  grpc:
    port: 8081
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  grpc:
    port: 8081
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- else if eq $preset "grpc-8081-http-readyz" -}}
startupProbe:
  grpc:
    port: 8081
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 72
readinessProbe:
  httpGet:
    path: /readyz
    port: http
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  grpc:
    port: 8081
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- else if eq $preset "http-readyz" -}}
startupProbe:
  httpGet:
    path: /readyz
    port: http
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 72
readinessProbe:
  httpGet:
    path: /readyz
    port: http
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /readyz
    port: http
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- else if eq $preset "http-api-readyz" -}}
startupProbe:
  httpGet:
    path: /api/readyz
    port: http
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 72
readinessProbe:
  httpGet:
    path: /api/readyz
    port: http
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /api/healthz
    port: http
  periodSeconds: 20
  timeoutSeconds: 5
  failureThreshold: 3
{{- else if eq $preset "http-healthz-fast" -}}
startupProbe:
  httpGet:
    path: /healthz
    port: http
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 12
readinessProbe:
  httpGet:
    path: /healthz
    port: http
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /healthz
    port: http
  periodSeconds: 20
  timeoutSeconds: 2
  failureThreshold: 3
{{- else if eq $preset "http-api-readyz-fast" -}}
startupProbe:
  httpGet:
    path: /api/readyz
    port: http
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 12
readinessProbe:
  httpGet:
    path: /api/readyz
    port: http
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
  successThreshold: 1
livenessProbe:
  httpGet:
    path: /api/healthz
    port: http
  periodSeconds: 20
  timeoutSeconds: 2
  failureThreshold: 3
{{- else -}}
{{- fail (printf "unknown probePreset %q" $preset) -}}
{{- end -}}
{{- end -}}
