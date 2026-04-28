{{- define "infrastructure.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "infrastructure.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "infrastructure.labels" -}}
helm.sh/chart: {{ include "infrastructure.chart" .root }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: {{ .root.Values.global.partOf }}
{{ include "infrastructure.selectorLabels" . }}
{{- if .componentLabel }}
app.kubernetes.io/component: {{ .componentLabel }}
{{- end }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end -}}

{{- define "infrastructure.observabilityAmbientPodLabels" -}}
{{- if .root.Values.global.observabilityAmbientPodOptOut }}
istio.io/dataplane-mode: none
{{- end }}
{{- end -}}

{{- define "infrastructure.renderHttpRoute" -}}
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
  namespace: {{ $root.Values.global.observabilityNamespace }}
  labels:
{{ include "infrastructure.labels" (dict "root" $root "name" .name "componentLabel" "dashboard") | nindent 4 }}
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
            value: {{ $route.path | quote }}
      backendRefs:
        - name: {{ .serviceName }}
          port: {{ .servicePort }}
{{- end -}}
