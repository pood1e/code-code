import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { PrismaModule } from '../../prisma/prisma.module';
import { LocalNotificationCapability } from './capabilities/local-notification.capability';
import { LocalNotificationSenderService } from './capabilities/local-notification-sender.service';
import { MacOsLocalNotificationSenderService } from './capabilities/macos-local-notification-sender.service';
import { NodeNotifierLocalNotificationSenderService } from './capabilities/node-notifier-local-notification-sender.service';
import { NotificationCapabilitiesService } from './notification-capabilities.service';
import { NotificationChannelsService } from './notification-channels.service';
import { NotificationCapabilityRegistry } from './notification-capability.registry';
import { NotificationConfig } from './notification-config';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationMaintenanceService } from './notification-maintenance.service';
import { NotificationReceiverService } from './notification-receiver.service';
import { NotificationRepositoryService } from './notification-repository.service';
import { NotificationTasksService } from './notification-tasks.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule, DiscoveryModule],
  controllers: [NotificationsController],
  providers: [
    NotificationConfig,
    NotificationRepositoryService,
    NotificationCapabilityRegistry,
    NotificationCapabilitiesService,
    NotificationChannelsService,
    NotificationTasksService,
    NotificationReceiverService,
    NotificationDispatcherService,
    NotificationMaintenanceService,
    MacOsLocalNotificationSenderService,
    NodeNotifierLocalNotificationSenderService,
    LocalNotificationSenderService,
    LocalNotificationCapability
  ],
  exports: [NotificationReceiverService, NotificationCapabilityRegistry]
})
export class NotificationsModule {}
