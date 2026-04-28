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

{{- define "platform.notificationService" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
  labels:
{{ include "platform.labels" (dict "root" .root "name" .name "componentLabel" .componentLabel) | nindent 4 }}
spec:
  selector:
{{ include "platform.selectorLabels" (dict "root" .root "name" .name) | nindent 4 }}
  ports:
    - name: http
      port: {{ .port }}
      targetPort: http
{{- end -}}

{{- define "platform.lifecyclePreStop" -}}
preStop:
  sleep:
    seconds: 5
{{- end -}}

{{- define "platform.httpProbes" -}}
startupProbe:
  httpGet:
    path: {{ .path }}
    port: http
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: {{ .startupFailureThreshold }}
readinessProbe:
  httpGet:
    path: {{ .path }}
    port: http
  timeoutSeconds: 5
  failureThreshold: {{ .readinessFailureThreshold }}
livenessProbe:
  httpGet:
    path: {{ .path }}
    port: http
  timeoutSeconds: 5
  failureThreshold: {{ .livenessFailureThreshold }}
{{- end -}}

{{- define "platform.restrictedContainerSecurityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop:
    - ALL
readOnlyRootFilesystem: true
runAsNonRoot: true
{{- if .seccomp }}
seccompProfile:
  type: RuntimeDefault
{{- end }}
{{- end -}}

{{- define "platform.resources" -}}
requests:
  cpu: {{ .cpuRequest }}
  memory: {{ .memoryRequest }}
  ephemeral-storage: {{ .ephemeralStorageRequest }}
limits:
  cpu: {{ .cpuLimit }}
  memory: {{ .memoryLimit }}
  ephemeral-storage: {{ .ephemeralStorageLimit }}
{{- end -}}

{{- define "platform.wecomAdapterDeployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .component.name }}
  labels:
{{ include "platform.labels" (dict "root" .root "name" .component.name "componentLabel" "inbound-message-adapter") | nindent 4 }}
spec:
  replicas: 1
  revisionHistoryLimit: 2
  progressDeadlineSeconds: 300
  selector:
    matchLabels:
{{ include "platform.selectorLabels" (dict "root" .root "name" .component.name) | nindent 6 }}
  template:
    metadata:
      labels:
{{ include "platform.labels" (dict "root" .root "name" .component.name "componentLabel" "inbound-message-adapter") | nindent 8 }}
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: adapter
          image: {{ include "platform.image" (dict "root" .root "imageName" .component.imageName) }}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
          lifecycle:
{{ include "platform.lifecyclePreStop" . | indent 12 }}
          env:
            - name: WECOM_CALLBACK_ENCODING_AES_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ .secretName }}
                  key: encoding-aes-key
            - name: WECOM_CALLBACK_HTTP_ADDR
              value: :8080
            - name: WECOM_CALLBACK_NATS_SUBJECT
              value: {{ .subject }}
            - name: WECOM_CALLBACK_NATS_URL
              value: {{ .root.Values.notificationDispatcher.natsUrl | quote }}
            - name: WECOM_CALLBACK_PATH
              value: {{ .path }}
            - name: WECOM_CALLBACK_TOKEN
              valueFrom:
                secretKeyRef:
                  name: {{ .secretName }}
                  key: token
{{ include "platform.httpProbes" (dict "path" "/healthz" "startupFailureThreshold" 12 "readinessFailureThreshold" 6 "livenessFailureThreshold" 6) | indent 10 }}
          securityContext:
{{ include "platform.restrictedContainerSecurityContext" (dict "seccomp" false) | indent 12 }}
          resources:
{{ include "platform.resources" (dict "cpuRequest" "10m" "memoryRequest" "32Mi" "ephemeralStorageRequest" "32Mi" "cpuLimit" "100m" "memoryLimit" "128Mi" "ephemeralStorageLimit" "128Mi") | indent 12 }}
{{- end -}}
