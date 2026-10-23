{{- $envData := include "manifest.addEnvsAndEnvFile" (list .filename .) -}}
{{- $filteredEnvData := regexReplaceAll "(?m)^LLM_VLLM_API_KEY:.*\n?" $envData "" -}}
---
# Source: llm-usvc/templates/configmap.yaml
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

apiVersion: v1
kind: ConfigMap
metadata:
  name: llm-usvc-config
  labels:
    {{- include "manifest.labels" (list .filename .) | nindent 4 }}
data:
  {{- $filteredEnvData | nindent 2 }}
  http_proxy: {{ .Values.proxy.http_proxy | quote }}
  https_proxy: {{ .Values.proxy.https_proxy | quote }}
  no_proxy: {{ .Values.proxy.no_proxy | quote }}
---
# Source: llm-usvc/templates/service.yaml
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

apiVersion: v1
kind: Service
metadata:
  name: llm-usvc
  labels:
    {{- include "manifest.labels" (list .filename .) | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: 9000
      targetPort: 9000
      protocol: TCP
      name: llm-usvc
  selector:
    {{- include "manifest.selectorLabels" (list .filename .) | nindent 4 }}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    app.kubernetes.io/name: llm-usvc
    app.kubernetes.io/instance: llm-usvc
  name: llm-usvc
---
# Source: llm-usvc/templates/deployment.yaml
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-usvc
  labels:
    {{- include "manifest.labels" (list .filename .) | nindent 4 }}
spec:
  replicas: {{ include "getReplicas" (list .filename .Values) | default 1 }}
  selector:
    matchLabels:
    {{- include "manifest.selectorLabels" (list .filename .) | nindent 6 }}
  template:
    metadata:
      {{- include "manifest.podLabels" (list .filename .) | nindent 6 }}
    spec:
      serviceAccountName: llm-usvc
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      initContainers:
        - name: wait-for-model-server
          image: alpine/curl
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          envFrom:
            - configMapRef:
                name: llm-usvc-config
            - configMapRef:
                name: extra-env-config
                optional: true
          command:
            - sh
            - -c
            - |
                if [ -n "$LLM_TLS_SKIP_VERIFY" ]; then
                  ADDITIONAL_CURL_FLAGS="-k"
                fi;
                if [ -z "$LLM_MODEL_SERVER_ENDPOINT" ]; then
                  echo "Environment variable LLM_MODEL_SERVER_ENDPOINT is not set. Skipping the init container.";
                elif [ -z "$LLM_MODEL_NAME" ]; then
                  until curl $ADDITIONAL_CURL_FLAGS -sf ${LLM_MODEL_SERVER_ENDPOINT}/health; do
                    echo "waiting for LLM server ${LLM_MODEL_SERVER_ENDPOINT}/health to be ready...";
                    sleep 2;
                  done;
                else
                  echo "Probing model $LLM_MODEL_NAME via ${LLM_MODEL_SERVER_ENDPOINT}/v1/chat/completions...";
                  until curl $ADDITIONAL_CURL_FLAGS -sf \
                    -X POST "${LLM_MODEL_SERVER_ENDPOINT}/v1/chat/completions" \
                    -H "Content-Type: application/json" \
                    -d "{\"model\":\"${LLM_MODEL_NAME}\",\"max_tokens\":1,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
                    | grep -q '"choices"'; do
                    echo "waiting for model $LLM_MODEL_NAME to be serving...";
                    sleep 5;
                  done;
                fi;
      {{- include "gmc.imagePullSecrets" . }}
      containers:
        - name: llm-usvc
          envFrom:
            - configMapRef:
                name: llm-usvc-config
            - configMapRef:
                name: extra-env-config
                optional: true
          env:
          {{- if .Values.tokens.hug_token }}
            - name: HF_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token-secret
                  key: HF_TOKEN
          {{- end }}
            - name: LLM_VLLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: vllm-api-key-secret
                  key: LLM_VLLM_API_KEY
                  optional: true
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
              - ALL
            readOnlyRootFilesystem: true
          image: {{ include "manifest.image" (list .filename .Values) }}
          imagePullPolicy: {{ toYaml (index .Values "images" .filename "pullPolicy" | default "Always") }}
          ports:
            - name: llm-usvc
              containerPort: 9000
              protocol: TCP
          volumeMounts:
            - mountPath: /tmp
              name: tmp
          livenessProbe:
            failureThreshold: 24
            httpGet:
              path: v1/health_check
              port: llm-usvc
            initialDelaySeconds: 5
            periodSeconds: 60
            timeoutSeconds: 10
          readinessProbe:
            httpGet:
              path: v1/health_check
              port: llm-usvc
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 10
          startupProbe:
            failureThreshold: {{ if and (hasKey .Values "startupProbe") (hasKey .Values.startupProbe "failureThreshold") }}{{ .Values.startupProbe.failureThreshold }}{{ else }}240{{ end }}
            httpGet:
              path: v1/health_check
              port: llm-usvc
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 10
          resources:
            {{- $defaultValues := "{requests: {cpu: '1', memory: '2Gi'}, limits: {cpu: '4', memory: '6Gi'}}" -}}
            {{- include "manifest.getResource" (list .filename $defaultValues .Values) | nindent 12 }}
      volumes:
        - name: tmp
          emptyDir: {}
{{- include "manifest.serviceMonitor" (list .filename "llm-usvc" .) }}

