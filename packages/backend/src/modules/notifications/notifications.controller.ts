import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { NotificationTaskStatus } from '@agent-workbench/shared';

import {
  CreateNotificationChannelDto,
  UpdateNotificationChannelDto
} from './dto/channel.dto';
import { ReceiveNotificationMessageDto } from './dto/receive-notification-message.dto';
import { NotificationCapabilitiesService } from './notification-capabilities.service';
import { NotificationChannelsService } from './notification-channels.service';
import { NotificationReceiverService } from './notification-receiver.service';
import { NotificationTasksService } from './notification-tasks.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly receiver: NotificationReceiverService,
    private readonly capabilitiesService: NotificationCapabilitiesService,
    private readonly channelsService: NotificationChannelsService,
    private readonly tasksService: NotificationTasksService
  ) {}

  @Post('receive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '接收结构化内部通知消息，并为匹配通道生成任务' })
  receive(@Body() dto: ReceiveNotificationMessageDto) {
    return this.receiver.receive(dto);
  }

  @Get('capabilities')
  @ApiOperation({ summary: '列出已注册的通知能力插件' })
  listCapabilities() {
    return this.capabilitiesService.list();
  }

  @Get('channels')
  @ApiOperation({ summary: '查询通知通道列表（按 scopeId 过滤）' })
  @ApiQuery({ name: 'scopeId', type: String, required: false })
  listChannels(@Query('scopeId') scopeId?: string) {
    return this.channelsService.list(scopeId);
  }

  @Get('channels/:id')
  @ApiOperation({ summary: '查询通知通道详情' })
  getChannel(@Param('id') id: string) {
    return this.channelsService.getById(id);
  }

  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建通知通道实例' })
  createChannel(@Body() dto: CreateNotificationChannelDto) {
    return this.channelsService.create({
      scopeId: dto.scopeId,
      name: dto.name,
      capabilityId: dto.capabilityId,
      config: dto.config,
      filter: dto.filter,
      enabled: dto.enabled
    });
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: '更新通知通道配置' })
  updateChannel(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationChannelDto
  ) {
    return this.channelsService.update(id, dto);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: '删除通知通道（有活跃任务时拒绝）' })
  deleteChannel(@Param('id') id: string) {
    return this.channelsService.delete(id);
  }

  @Get('tasks')
  @ApiOperation({ summary: '查询通知任务列表' })
  @ApiQuery({ name: 'scopeId', type: String, required: false })
  @ApiQuery({ name: 'channelId', type: String, required: false })
  @ApiQuery({ name: 'status', enum: NotificationTaskStatus, required: false })
  @ApiQuery({ name: 'messageId', type: String, required: false })
  listTasks(
    @Query('scopeId') scopeId?: string,
    @Query('channelId') channelId?: string,
    @Query('status') status?: NotificationTaskStatus,
    @Query('messageId') messageId?: string
  ) {
    return this.tasksService.list({
      scopeId,
      channelId,
      status,
      messageId
    });
  }

  @Post('tasks/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动重试失败任务（仅 failed -> pending）' })
  retryTask(@Param('id') id: string) {
    return this.tasksService.retry(id);
  }
}
