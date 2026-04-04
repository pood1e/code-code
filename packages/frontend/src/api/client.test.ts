import type { AxiosError, AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const interceptorState = vi.hoisted(() => ({
  onFulfilled: undefined as
    | ((response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>)
    | undefined,
  onRejected: undefined as
    | ((error: unknown) => Promise<never> | never)
    | undefined
}));

vi.mock('axios', () => {
  const create = vi.fn(() => ({
    interceptors: {
      response: {
        use: vi.fn((onFulfilled, onRejected) => {
          interceptorState.onFulfilled = onFulfilled;
          interceptorState.onRejected = onRejected;
          return 0;
        })
      }
    }
  }));

  return {
    default: {
      create
    },
    create,
    AxiosError: class {}
  };
});

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    interceptorState.onFulfilled = undefined;
    interceptorState.onRejected = undefined;
  });

  it('toApiRequestError 应归一化未知错误、axios 错误和已归一化错误', async () => {
    const {
      ApiRequestError,
      getApiErrorCode,
      isNotFoundApiError,
      toApiRequestError
    } = await import('./client');

    expect(toApiRequestError('boom')).toMatchObject({
      name: 'ApiRequestError',
      code: 500,
      message: 'Request failed',
      data: null
    });

    const apiError = new ApiRequestError({
      code: 409,
      message: 'Conflict',
      data: {
        reason: 'RUNNING'
      }
    });
    expect(toApiRequestError(apiError)).toBe(apiError);
    expect(getApiErrorCode(apiError)).toBe(409);
    expect(isNotFoundApiError(apiError)).toBe(false);

    const axiosError = {
      response: {
        status: 404,
        data: {
          code: 404,
          message: 'Not found',
          data: {
            id: 'project-1'
          }
        }
      }
    } as AxiosError;

    const normalizedError = toApiRequestError(axiosError);
    expect(normalizedError).toMatchObject({
      code: 404,
      message: 'Not found',
      data: {
        id: 'project-1'
      }
    });
    expect(isNotFoundApiError(normalizedError)).toBe(true);
  });

  it('响应拦截器应解包 ApiResponse，并保留 blob/string 响应', async () => {
    await import('./client');

    const onFulfilled = interceptorState.onFulfilled;
    expect(onFulfilled).toBeTypeOf('function');

    const apiResponse = await onFulfilled!(
      {
        data: {
          data: {
            id: 'project-1'
          }
        },
        config: {}
      } as AxiosResponse
    );
    expect(apiResponse.data).toEqual({
      id: 'project-1'
    });

    const blobResponse = {
      data: new Blob(['hello']),
      config: {
        responseType: 'blob'
      }
    } as AxiosResponse;
    expect(await onFulfilled!(blobResponse)).toBe(blobResponse);

    const textResponse = {
      data: 'plain text',
      config: {}
    } as AxiosResponse;
    expect(await onFulfilled!(textResponse)).toBe(textResponse);
  });

  it('错误拦截器应拒绝归一化后的 ApiRequestError', async () => {
    const { ApiRequestError } = await import('./client');

    const onRejected = interceptorState.onRejected;
    expect(onRejected).toBeTypeOf('function');

    await expect(
      onRejected!({
        response: {
          status: 400,
          data: {
            code: 400,
            message: 'Bad request',
            data: {
              field: 'name'
            }
          }
        }
      } as AxiosError)
    ).rejects.toEqual(
      new ApiRequestError({
        code: 400,
        message: 'Bad request',
        data: {
          field: 'name'
        }
      })
    );
  });
});
