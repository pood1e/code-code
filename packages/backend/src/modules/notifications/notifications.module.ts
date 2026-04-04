import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NOTIFICATION_CHANNELS } from './notification-channel.interface';
import { NotificationChannelRegistry } from './notification-channel-registry';
import { NotificationConfig } from './notification-config';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationMaintenanceService } from './notification-maintenance.service';
import { NotificationReceiverService } from './notification-receiver.service';
import { NotificationRepositoryService } from './notification-repository.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationConfig,
    NotificationRepositoryService,
    NotificationChannelRegistry,
    NotificationReceiverService,
    NotificationDispatcherService,
    NotificationMaintenanceService,
    {
      // 本期无具体渠道实现，注册空数组。
      // 新增渠道类型：在此数组中追加实现 INotificationChannel 的服务，
      // 通过 channelType 字段与数据库 NotificationChannel.channelType 对应。
      provide: NOTIFICATION_CHANNELS,
      useValue: []
    }
  ],
  exports: [NotificationReceiverService]
})
export class NotificationsModule {}
