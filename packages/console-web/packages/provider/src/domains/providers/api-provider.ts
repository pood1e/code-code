import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ProviderViewSchema,
  type ProviderView,
  UpdateProviderAuthenticationRequestSchema,
  UpdateProviderAuthenticationResponseSchema,
  UpdateProviderObservabilityAuthenticationRequestSchema,
  UpdateProviderRequestSchema,
} from "@code-code/agent-contract/platform/management/v1";
import { jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";

const providersPath = "/api/providers";

export async function updateProvider(providerId: string, displayName: string): Promise<ProviderView> {
  const request = create(UpdateProviderRequestSchema, {
    providerId: providerId,
    displayName,
  });
  const data = await jsonRequest<JsonValue>(`${providersPath}/${providerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpdateProviderRequestSchema, request)),
  });
  return fromJson(ProviderViewSchema, data, protobufJsonReadOptions);
}

export async function updateProviderAuthentication(
  providerId: string,
  authMaterial:
    | { case: "apiKey"; value: { apiKey: string } }
    | { case: "cliOauth"; value: Record<string, never> }
) {
  const request = create(UpdateProviderAuthenticationRequestSchema, {
    providerId: providerId,
    authMaterial,
  });
  const data = await jsonRequest<JsonValue>(`${providersPath}/${providerId}/authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpdateProviderAuthenticationRequestSchema, request)),
  });
  return fromJson(UpdateProviderAuthenticationResponseSchema, data, protobufJsonReadOptions);
}

export async function updateProviderObservabilityAuthentication(providerId: string, sessionMaterial: {
  schemaId: string;
  requiredKeys?: string[];
  values: Record<string, string>;
}): Promise<ProviderView> {
  const request = create(UpdateProviderObservabilityAuthenticationRequestSchema, {
    providerId: providerId,
    sessionMaterial,
  });
  const data = await jsonRequest<JsonValue>(`${providersPath}/${providerId}/observability-authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toJson(UpdateProviderObservabilityAuthenticationRequestSchema, request)),
  });
  return fromJson(ProviderViewSchema, data, protobufJsonReadOptions);
}

export async function deleteProvider(providerId: string) {
  await jsonRequest<void>(`${providersPath}/${providerId}`, {
    method: "DELETE",
  });
}
