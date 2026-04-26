import { getApiRequestUrl } from "./api-base-url";

type ApiErrorPayload = {
  code?: string;
  message?: string;
  error_code?: string;
  error_detail?: string;
};

async function getErrorMessage(response: Response) {
  try {
    const payload = await response.json() as ApiErrorPayload;
    if (payload.error_detail) {
      return payload.error_detail;
    }
    if (payload.error_code) {
      return payload.error_code;
    }
    if (payload.message) {
      return payload.message;
    }
    if (payload.code) {
      return payload.code;
    }
  } catch {
    // Ignore non-JSON error bodies and fall back to the status code.
  }

  return `HTTP Error ${response.status}`;
}

function getJsonHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return headers;
}

export async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiRequestUrl(path), {
    ...init,
    headers: getJsonHeaders(init)
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();
  if (!body) {
    return undefined as T;
  }

  return JSON.parse(body) as T;
}

export function jsonFetcher<T>(path: string) {
  return jsonRequest<T>(path);
}
