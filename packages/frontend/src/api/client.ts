import type { ApiResponse } from '@agent-workbench/shared';
import { useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

type ApiErrorPayload = {
  code: number;
  message: string;
  data: unknown;
};

export class ApiRequestError extends Error {
  code: number;
  data: unknown;

  constructor({ code, message, data }: ApiErrorPayload) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.data = data;
  }
}

export type ReferencedProfile = {
  id: string;
  name: string;
};

function isReferencedProfile(value: unknown): value is ReferencedProfile {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
  );
}

export function toApiRequestError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (!error || typeof error !== 'object') {
    return new ApiRequestError({
      code: 500,
      message: 'Request failed',
      data: null
    });
  }

  const axiosError = error as AxiosError<Partial<ApiErrorPayload>>;
  const payload = axiosError.response?.data;

  return new ApiRequestError({
    code: payload?.code ?? axiosError.response?.status ?? 500,
    message: payload?.message ?? 'Request failed',
    data: payload?.data ?? null
  });
}

export function getApiErrorCode(error: unknown) {
  return toApiRequestError(error).code;
}

export function isNotFoundApiError(error: unknown) {
  return getApiErrorCode(error) === 404;
}

export function getReferencedProfiles(data: unknown) {
  if (
    !data ||
    typeof data !== 'object' ||
    !('referencedBy' in data) ||
    !Array.isArray(data.referencedBy)
  ) {
    return [];
  }

  return data.referencedBy.filter(isReferencedProfile);
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api'
});

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

apiClient.interceptors.response.use(
  (response) => {
    if (
      response.config.responseType === 'blob' ||
      typeof response.data === 'string'
    ) {
      return response;
    }

    return {
      ...response,
      data: (response.data as ApiResponse<unknown>).data
    };
  },
  (error) => Promise.reject(toApiRequestError(error))
);

export function useErrorMessage() {
  return useCallback((error: unknown) => {
    const apiError = toApiRequestError(error);
    toast.error(apiError.message);
  }, []);
}
