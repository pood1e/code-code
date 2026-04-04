import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import type { NotificationCapabilitySummary } from '@agent-workbench/shared';

import { zodToSchemaDescriptor } from '../agent-runners/schema-descriptor.util';
import {
  DEFAULT_MAX_RETRIES,
  NotificationCapability
} from './notification-capability.interface';
import { NOTIFICATION_CAPABILITY_METADATA } from './notification-capability.decorator';

@Injectable()
export class NotificationCapabilityRegistry implements OnModuleInit {
  private readonly capabilities = new Map<string, NotificationCapability>();

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit(): void {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance || !wrapper.metatype) {
        continue;
      }

      const isCapability = Reflect.getMetadata(
        NOTIFICATION_CAPABILITY_METADATA,
        wrapper.metatype
      );
      if (!isCapability) {
        continue;
      }

      this.register(instance as NotificationCapability);
    }
  }

  register(capability: NotificationCapability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(
        `Duplicate notification capability registered: "${capability.id}"`
      );
    }

    this.capabilities.set(capability.id, capability);
  }

  get(id: string): NotificationCapability | undefined {
    return this.capabilities.get(id);
  }

  getMaxRetries(id: string): number {
    return this.get(id)?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  getAll(): NotificationCapability[] {
    return Array.from(this.capabilities.values());
  }

  getAllResponses(): NotificationCapabilitySummary[] {
    return this.getAll().map((capability) => ({
      id: capability.id,
      name: capability.name,
      description: capability.description,
      configSchema: zodToSchemaDescriptor(capability.configSchema)
    }));
  }
}
