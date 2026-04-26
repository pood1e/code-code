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
