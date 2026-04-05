import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { apiRouteConfig } from '../api-route.config';
import { ChatsService } from './chats.service';
import { ChatQueryDto, CreateChatDto, UpdateChatDto } from './dto/chat.dto';

@ApiTags('Chats')
@Controller(apiRouteConfig.chats.path)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a chat (and its underlying session)' })
  @ApiResponse({ status: 201, description: 'Chat created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid chat payload.',
    messageExample: 'scopeId must not be empty'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project or runner not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Chat created')
  create(@Body() dto: CreateChatDto) {
    return this.chatsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List chats' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Chat list fetched.' })
  @ResponseMessage('Chat list fetched')
  list(@Query() query: ChatQueryDto) {
    return this.chatsService.list(query.scopeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get chat detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chat fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Chat not found.',
    messageExample: 'Chat not found: chat_123'
  })
  @ResponseMessage('Chat fetched')
  getById(@Param('id') id: string) {
    return this.chatsService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update chat title' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chat updated.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Chat not found.',
    messageExample: 'Chat not found: chat_123'
  })
  @ResponseMessage('Chat updated')
  update(@Param('id') id: string, @Body() dto: UpdateChatDto) {
    return this.chatsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a chat (disposes the session)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Chat deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Chat not found.',
    messageExample: 'Chat not found: chat_123'
  })
  @ResponseMessage('Chat deleted')
  delete(@Param('id') id: string) {
    return this.chatsService.delete(id);
  }
}
