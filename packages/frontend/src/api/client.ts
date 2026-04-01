import type { ApiResponse } from '@agent-workbench/shared';
import { useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { Modal, message } from 'antd';

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

type ReferencedProfile = {
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

function toApiRequestError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  const axiosError = error as AxiosError<Partial<ApiErrorPayload>>;
  const payload = axiosError.response?.data;

  return new ApiRequestError({
    code: payload?.code ?? axiosError.response?.status ?? 500,
    message: payload?.message ?? 'Request failed',
    data: payload?.data ?? null
  });
}

function getReferencedProfiles(data: unknown) {
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
    void message.error(apiError.message);
  }, []);
}

export function showReferencedProfilesModal(error: ApiRequestError) {
  const referencedBy = getReferencedProfiles(error.data);

  Modal.error({
    title: '资源仍被 Profile 引用',
    content: referencedBy.length
      ? `以下 Profile 仍在引用当前资源，删除已被阻止：\n${referencedBy
          .map((item) => `${item.name} (${item.id})`)
          .join('\n')}`
      : error.message
  });
}
