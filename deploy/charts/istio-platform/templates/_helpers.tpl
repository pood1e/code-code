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
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end -}}

{{- define "istio-platform.networkPolicyCommonMeshEgress" -}}
- ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
- to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: {{ .Values.global.istioNamespace }}
      podSelector: {}
  ports:
    - protocol: TCP
      port: 15012
{{- end -}}

{{- define "istio-platform.networkPolicyManagedL7Egress" -}}
{{ include "istio-platform.networkPolicyCommonMeshEgress" . }}
- to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: {{ .Values.global.platformNamespace }}
      podSelector:
        matchLabels:
          app.kubernetes.io/name: platform-auth-service
  ports:
    - protocol: TCP
      port: 15008
    - protocol: TCP
      port: 8081
- to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: {{ .Values.global.observabilityNamespace }}
      podSelector:
        matchLabels:
          app.kubernetes.io/name: otel-collector
  ports:
    - protocol: TCP
      port: 15008
    - protocol: TCP
      port: 4317
{{- if .Values.components.networkNamespaceEgress.externalPorts }}
- ports:
{{- range .Values.components.networkNamespaceEgress.externalPorts }}
    - protocol: TCP
      port: {{ . }}
{{- end }}
{{- end }}
{{- if .Values.components.networkNamespaceEgress.proxyPorts }}
- ports:
{{- range .Values.components.networkNamespaceEgress.proxyPorts }}
    - protocol: TCP
      port: {{ . }}
{{- end }}
{{- end }}
{{- end -}}
