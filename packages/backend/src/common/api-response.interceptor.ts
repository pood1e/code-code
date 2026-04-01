import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';

import { RESPONSE_MESSAGE_KEY } from './response-message.decorator';
import { SKIP_API_RESPONSE_KEY } from './skip-api-response.decorator';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<unknown> {
    const skipResponseWrapper =
      this.reflector.get<boolean>(SKIP_API_RESPONSE_KEY, context.getHandler()) ??
      false;

    if (skipResponseWrapper) {
      return next.handle();
    }

    const message =
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ??
      'success';
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        data,
        message,
        code: response.statusCode
      }))
    );
  }
}
