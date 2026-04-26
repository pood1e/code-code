{{- define "istio-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "istio-platform.labels" -}}
helm.sh/chart: {{ include "istio-platform.chart" .root }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: {{ .root.Values.global.partOf }}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- if .componentLabel }}
app.kubernetes.io/component: {{ .componentLabel }}
{{- end }}
app.kubernetes.io/version: {{ .root.Values.global.imageTag | quote }}
{{- end -}}

{{- define "istio-platform.wasmImage" -}}
{{- $registry := trimSuffix "/" (default "" .root.Values.global.imageRegistry) -}}
{{- if $registry -}}
{{- printf "oci://%s/code-code/%s:%s" $registry .imageName (default .root.Chart.AppVersion .root.Values.global.imageTag) -}}
{{- else -}}
{{- printf "oci://code-code/%s:%s" .imageName (default .root.Chart.AppVersion .root.Values.global.imageTag) -}}
{{- end -}}
{{- end -}}
