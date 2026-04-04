import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable
} from '@nestjs/common';

import { SessionsQueryService } from './sessions-query.service';

@Injectable()
export class SessionEventsGuard implements CanActivate {
  constructor(
    private readonly sessionsQueryService: SessionsQueryService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      params: { id?: string };
      query: { afterEventId?: string | string[] };
    }>();
    const sessionId = request.params.id ?? '';

    await this.sessionsQueryService.getSessionOrThrow(sessionId);

    const rawAfterEventId = request.query.afterEventId;
    if (rawAfterEventId === undefined) {
      return true;
    }

    if (Array.isArray(rawAfterEventId)) {
      throw new BadRequestException('afterEventId must be a non-negative integer');
    }

    const afterEventId = Number(rawAfterEventId);
    if (!Number.isInteger(afterEventId) || afterEventId < 0) {
      throw new BadRequestException('afterEventId must be a non-negative integer');
    }

    return true;
  }
}
