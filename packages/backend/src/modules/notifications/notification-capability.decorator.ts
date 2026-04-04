import { Injectable, SetMetadata } from '@nestjs/common';

export const NOTIFICATION_CAPABILITY_METADATA = Symbol(
  'NOTIFICATION_CAPABILITY_METADATA'
);

export function NotificationCapabilityProvider(): ClassDecorator {
  return (target) => {
    Injectable()(target);
    SetMetadata(NOTIFICATION_CAPABILITY_METADATA, true)(target);
  };
}
