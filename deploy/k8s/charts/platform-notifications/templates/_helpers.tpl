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
app.kubernetes.io/version: {{ .root.Values.global.imageTag | quote }}
{{- end -}}

{{- define "platform.image" -}}
{{- $registry := trimSuffix "/" (default "" .root.Values.global.imageRegistry) -}}
{{- if $registry -}}
{{- printf "%s/code-code/%s:%s" $registry .imageName (default .root.Chart.AppVersion .root.Values.global.imageTag) -}}
{{- else -}}
{{- printf "code-code/%s:%s" .imageName (default .root.Chart.AppVersion .root.Values.global.imageTag) -}}
{{- end -}}
{{- end -}}
