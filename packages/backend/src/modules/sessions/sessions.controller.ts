import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Sse
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { interval, map, merge, Subject, takeUntil, Observable } from 'rxjs';

import { ResponseMessage } from '../../common/response-message.decorator';
import { SkipApiResponse } from '../../common/skip-api-response.decorator';
import {
  CreateSessionDto,
  EditSessionMessageDto,
  SendSessionMessageDto,
  SessionEventsQueryDto,
  SessionMessagesQueryDto,
  SessionQueryDto
} from './dto/session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a session' })
  @ApiResponse({ status: 201, description: 'Session created.' })
  @ResponseMessage('Session created')
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sessions by scope' })
  @ApiQuery({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Session list fetched.' })
  @ResponseMessage('Session list fetched')
  list(@Query() query: SessionQueryDto) {
    return this.sessionsService.list(query.scopeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session detail fetched.' })
  @ResponseMessage('Session detail fetched')
  getById(@Param('id') id: string) {
    return this.sessionsService.getById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dispose a session' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session disposed.' })
  @ResponseMessage('Session disposed')
  dispose(@Param('id') id: string) {
    return this.sessionsService.dispose(id);
  }

  @Post(':id/messages')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a message to session' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session messages updated.' })
  @ResponseMessage('Session messages updated')
  sendMessage(@Param('id') id: string, @Body() dto: SendSessionMessageDto) {
    return this.sessionsService.sendMessage(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel current session output' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session output cancelled.' })
  @ResponseMessage('Session output cancelled')
  cancel(@Param('id') id: string) {
    return this.sessionsService.cancel(id);
  }

  @Post(':id/reload')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reload last assistant response' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session reloaded.' })
  @ResponseMessage('Session reloaded')
  reload(@Param('id') id: string) {
    return this.sessionsService.reload(id);
  }

  @Post(':id/messages/:messageId/edit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Edit a previous user message and rerun session' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'messageId', type: String })
  @ApiResponse({ status: 200, description: 'Session message edited.' })
  @ResponseMessage('Session message edited')
  editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditSessionMessageDto
  ) {
    return this.sessionsService.editMessage(id, messageId, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List session messages' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session messages fetched.' })
  @ResponseMessage('Session messages fetched')
  listMessages(
    @Param('id') id: string,
    @Query() query: SessionMessagesQueryDto
  ) {
    return this.sessionsService.listMessages(id, query.cursor, query.limit);
  }

  @Sse(':id/events')
  @SkipApiResponse()
  async stream(@Param('id') id: string, @Query() query: SessionEventsQueryDto) {
    const stop$ = new Subject<void>();

    const heartbeat$ = interval(30_000).pipe(
      takeUntil(stop$),
      map(
        () =>
          ({
            type: 'heartbeat',
            data: ''
          }) satisfies MessageEvent
      )
    );

    const events$ = await this.sessionsService.createEventsStream(
      id,
      query.afterEventId ?? 0
    );

    // When events$ completes (session disposed), stop heartbeat so merge also completes
    const boundEvents$ = new Observable<MessageEvent>((subscriber) => {
      events$.subscribe({
        next: (value) => subscriber.next(value),
        error: (error) => subscriber.error(error),
        complete: () => {
          stop$.next();
          stop$.complete();
          subscriber.complete();
        }
      });
    });

    return merge(boundEvents$, heartbeat$);
  }
}
