import { Injectable, SetMetadata } from '@nestjs/common';

export const RUNNER_TYPE_METADATA = Symbol('RUNNER_TYPE_METADATA');

/**
 * Marks a class as a RunnerType provider for automatic discovery.
 * Composes @Injectable() with custom metadata so RunnerTypeRegistry
 * can discover all runner types via NestJS DiscoveryService.
 */
export function RunnerTypeProvider(): ClassDecorator {
  return (target) => {
    Injectable()(target);
    SetMetadata(RUNNER_TYPE_METADATA, true)(target);
  };
}
