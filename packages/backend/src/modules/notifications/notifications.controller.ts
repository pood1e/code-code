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
import { ReceiveEventDto } from './dto/receive-event.dto';
import { NotificationChannelRegistry } from './notification-channel-registry';
import { NotificationMapper } from './notification-mapper';
import { NotificationReceiverService } from './notification-receiver.service';
import { NotificationRepositoryService } from './notification-repository.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly receiver: NotificationReceiverService,
    private readonly repository: NotificationRepositoryService,
    private readonly channelRegistry: NotificationChannelRegistry
  ) {}

  // ─── Event Receiving ──────────────────────────────────────────────────────────

  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '接收通知事件，按渠道过滤器匹配生成任务' })
  async receive(@Body() dto: ReceiveEventDto) {
    const eventId = await this.receiver.receive(
      dto.scopeId,
      dto.eventType,
      dto.payload
    );
    return { eventId };
  }

  // ─── Channel Types ────────────────────────────────────────────────────────────

  @Get('channel-types')
  @ApiOperation({ summary: '列出已注册的渠道类型' })
  listChannelTypes() {
    return this.channelRegistry.registeredChannelTypes();
  }

  // ─── Channels ─────────────────────────────────────────────────────────────────

  @Get('channels')
  @ApiOperation({ summary: '查询渠道列表（按 scopeId 过滤）' })
  @ApiQuery({ name: 'scopeId', type: String, required: false })
  async listChannels(@Query('scopeId') scopeId?: string) {
    const channels = await this.repository.listChannels(scopeId);
    return channels.map(NotificationMapper.toChannelSummary);
  }

  @Get('channels/:id')
  @ApiOperation({ summary: '查询渠道详情' })
  async getChannel(@Param('id') id: string) {
    const channel = await this.repository.findChannelById(id);
    return NotificationMapper.toChannelSummary(channel);
  }

  @Post('channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建通知渠道' })
  async createChannel(@Body() dto: CreateNotificationChannelDto) {
    const channel = await this.repository.createChannel({
      scopeId: dto.scopeId,
      name: dto.name,
      channelType: dto.channelType,
      config: dto.config ?? {},
      filter: dto.filter,
      enabled: dto.enabled ?? true
    });
    return NotificationMapper.toChannelSummary(channel);
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: '更新通知渠道配置' })
  async updateChannel(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationChannelDto
  ) {
    const channel = await this.repository.updateChannel(id, dto);
    return NotificationMapper.toChannelSummary(channel);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: '删除渠道（有活跃任务时拒绝）' })
  async deleteChannel(@Param('id') id: string) {
    await this.repository.deleteChannel(id);
    return { deleted: id };
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────────

  @Get('tasks')
  @ApiOperation({ summary: '查询通知任务列表' })
  @ApiQuery({ name: 'scopeId', type: String, required: false })
  @ApiQuery({ name: 'channelId', type: String, required: false })
  @ApiQuery({ name: 'status', enum: NotificationTaskStatus, required: false })
  @ApiQuery({ name: 'eventId', type: String, required: false })
  async listTasks(
    @Query('scopeId') scopeId?: string,
    @Query('channelId') channelId?: string,
    @Query('status') status?: NotificationTaskStatus,
    @Query('eventId') eventId?: string
  ) {
    const tasks = await this.repository.listTasks({
      scopeId,
      channelId,
      status,
      eventId
    });

    // 批量查 channels，避免 N+1
    const channelIds = [...new Set(tasks.map((t) => t.channelId))];
    const channelNameMap = new Map<string, string>();

    if (channelIds.length > 0) {
      const channels = await Promise.all(
        channelIds.map((cid) =>
          this.repository
            .findChannelById(cid)
            .then((ch) => ({ id: ch.id, name: ch.name }))
            .catch(() => ({ id: cid, name: cid }))
        )
      );
      for (const { id, name } of channels) {
        channelNameMap.set(id, name);
      }
    }

    return tasks.map((task) =>
      NotificationMapper.toTaskSummary(task, channelNameMap.get(task.channelId))
    );
  }

  @Post('tasks/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动重试失败任务（仅 failed → pending）' })
  async retryTask(@Param('id') id: string) {
    const task = await this.repository.resetFailedTask(id);
    return NotificationMapper.toTaskSummary(task);
  }
}
