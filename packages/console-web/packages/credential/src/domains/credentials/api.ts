import { create, fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import {
  ListCredentialsResponseSchema,
  UpsertCredentialRequestSchema,
  CredentialViewSchema,
  type CredentialView,
} from "@code-code/agent-contract/platform/management/v1";
import useSWR, { mutate } from "swr";
import { jsonFetcher, jsonRequest, protobufJsonReadOptions } from "@code-code/console-web-ui";

export type CredentialUpsertDraft = {
  credentialId: string;
  displayName: string;
  kind: string;
  purpose: string;
  vendorId: string;
  cliId: string;
  material:
    | {
      case: "apiKeyMaterial";
        value: {
          apiKey: string;
        };
      }
    | {
        case: "oauthMaterial";
        value: {
          accessToken: string;
          tokenType?: string;
          accountId?: string;
          scopes?: string[];
          expiresAt?: string;
        };
      };
};

export type { CredentialView };

const credentialsKey = "/api/credentials";

export function mutateCredentials() {
  return mutate(credentialsKey);
}

export function useCredentials() {
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(
    credentialsKey,
    jsonFetcher<JsonValue>
  );
  const response = data ? fromJson(ListCredentialsResponseSchema, data, protobufJsonReadOptions) : undefined;

  return {
    credentials: response?.items || ([] as CredentialView[]),
    isLoading,
    isError: !!error,
    error,
    mutate
  };
}

export async function createCredential(request: CredentialUpsertDraft): Promise<CredentialView> {
  const message = create(UpsertCredentialRequestSchema, request);
  const data = await jsonRequest<JsonValue>(credentialsKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(toJson(UpsertCredentialRequestSchema, message))
  });
  return fromJson(CredentialViewSchema, data, protobufJsonReadOptions);
}

export async function updateCredential(id: string, request: CredentialUpsertDraft): Promise<CredentialView> {
  const message = create(UpsertCredentialRequestSchema, request);
  message.credentialId = id;
  const data = await jsonRequest<JsonValue>(`${credentialsKey}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(toJson(UpsertCredentialRequestSchema, message))
  });
  return fromJson(CredentialViewSchema, data, protobufJsonReadOptions);
}

export async function deleteCredential(id: string) {
  await jsonRequest<void>(`${credentialsKey}/${id}`, {
    method: "DELETE"
  });
}
