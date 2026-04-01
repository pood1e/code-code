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
  (error) => {
    const axiosError = error as AxiosError<Partial<ApiErrorPayload>>;
    const payload = axiosError.response?.data;

    return Promise.reject(
      new ApiRequestError({
        code: payload?.code ?? axiosError.response?.status ?? 500,
        message: payload?.message ?? 'Request failed',
        data: payload?.data ?? null
      })
    );
  }
);

export function useErrorMessage() {
  return useCallback((error: unknown) => {
    const apiError =
      error instanceof ApiRequestError
        ? error
        : new ApiRequestError({
            code: 500,
            message: 'Request failed',
            data: null
          });
    void message.error(apiError.message);
  }, []);
}

export function showReferencedProfilesModal(error: ApiRequestError) {
  const referencedBy = ((
    error.data as { referencedBy?: Array<{ id: string; name: string }> } | null
  )?.referencedBy ?? []) as Array<{ id: string; name: string }>;

  Modal.error({
    title: '资源仍被 Profile 引用',
    content: referencedBy.length
      ? `以下 Profile 仍在引用当前资源，删除已被阻止：\n${referencedBy
          .map((item) => `${item.name} (${item.id})`)
          .join('\n')}`
      : error.message
  });
}
