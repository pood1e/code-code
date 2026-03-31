import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Response } from 'express';

type ErrorPayload = {
  message?: string | string[];
  data?: unknown;
  referencedBy?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? (exception.getResponse() as ErrorPayload | string)
        : null;

    const normalized =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : {
            message: exceptionResponse?.message,
            data:
              exceptionResponse?.data ??
              (exceptionResponse?.referencedBy
                ? { referencedBy: exceptionResponse.referencedBy }
                : undefined)
          };

    const message = Array.isArray(normalized.message)
      ? normalized.message.join(', ')
      : (normalized.message ?? 'Internal server error');

    response.status(status).json({
      code: status,
      message,
      data: normalized.data ?? null
    });
  }
}
