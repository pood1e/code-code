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

{{- define "platform.serviceAccountName" -}}
{{- $serviceAccount := .component.serviceAccount | default dict -}}
{{- if or $serviceAccount.create $serviceAccount.name -}}
{{- default .component.name $serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "platform.renderEnv" -}}
{{- $root := .root -}}
{{- $env := .env | default dict -}}
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
{{- $ports := .ports | default dict -}}
{{- range $name := keys $ports | sortAlpha }}
- name: {{ $name }}
  containerPort: {{ int (index $ports $name) }}
{{- end -}}
{{- end -}}

{{- define "platform.renderServicePorts" -}}
{{- $service := .service -}}
{{- $ports := $service.ports | default dict -}}
{{- $targetPorts := $service.targetPorts | default dict -}}
{{- range $name := keys $ports | sortAlpha }}
- name: {{ $name }}
  port: {{ int (index $ports $name) }}
  targetPort: {{ default $name (index $targetPorts $name) }}
{{- end -}}
{{- end -}}

{{- define "platform.renderVolumeMounts" -}}
{{- $mounts := .mounts | default dict -}}
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
{{- $volumes := .volumes | default dict -}}
{{- range $key := keys $volumes | sortAlpha }}
{{- $volume := index $volumes $key }}
- name: {{ default $key $volume.name }}
{{ toYaml (omit $volume "name") | nindent 2 }}
{{- end -}}
{{- end -}}
