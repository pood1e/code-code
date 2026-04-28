{{- define "devImageInfra.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "devImageInfra.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{- define "devImageInfra.labels" -}}
helm.sh/chart: {{ include "devImageInfra.chart" .root }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: {{ .root.Values.global.partOf }}
{{ include "devImageInfra.selectorLabels" . }}
{{- if .componentLabel }}
app.kubernetes.io/component: {{ .componentLabel }}
{{- end }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end -}}

{{- define "devImageInfra.renderRegistry" -}}
{{- $root := .root -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .name }}
  namespace: {{ $root.Values.global.infraNamespace }}
  labels:
{{ include "devImageInfra.labels" (dict "root" $root "name" .name "componentLabel" .componentLabel) | nindent 4 }}
spec:
  replicas: {{ .replicaCount }}
  selector:
    matchLabels:
{{ include "devImageInfra.selectorLabels" (dict "root" $root "name" .name) | nindent 6 }}
  template:
    metadata:
      labels:
{{ include "devImageInfra.labels" (dict "root" $root "name" .name "componentLabel" .componentLabel) | nindent 8 }}
    spec:
      containers:
        - name: {{ .containerName }}
          image: {{ .image }}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: {{ .port }}
              protocol: TCP
          env:
            - name: REGISTRY_HTTP_ADDR
              value: ":{{ .port }}"
            - name: REGISTRY_STORAGE_DELETE_ENABLED
              value: {{ ternary "true" "false" .deleteEnabled | quote }}
            {{- if .remoteUrl }}
            - name: REGISTRY_PROXY_REMOTEURL
              value: {{ .remoteUrl | quote }}
            {{- end }}
          resources:
{{ toYaml .resources | nindent 12 }}
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            readOnlyRootFilesystem: false
            runAsNonRoot: true
            runAsUser: 1000
            runAsGroup: 1000
            seccompProfile:
              type: RuntimeDefault
          volumeMounts:
            - name: storage
              mountPath: /var/lib/registry
      volumes:
        - name: storage
{{- if .persistentVolumeClaim }}
          persistentVolumeClaim:
            claimName: {{ .persistentVolumeClaim }}
{{- else }}
          emptyDir: {}
{{- end }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
  namespace: {{ $root.Values.global.infraNamespace }}
  labels:
{{ include "devImageInfra.labels" (dict "root" $root "name" .name "componentLabel" .componentLabel) | nindent 4 }}
spec:
  type: {{ .serviceType }}
  selector:
{{ include "devImageInfra.selectorLabels" (dict "root" $root "name" .name) | nindent 4 }}
  ports:
    - name: http
      port: {{ .port }}
      protocol: TCP
      targetPort: http
{{- if and (eq .serviceType "NodePort") (gt (int .nodePort) 0) }}
      nodePort: {{ .nodePort }}
{{- end }}
{{- end -}}
