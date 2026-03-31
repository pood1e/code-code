import { Module } from '@nestjs/common';

import { McpsController } from './mcps.controller';
import { McpsService } from './mcps.service';

@Module({
  controllers: [McpsController],
  providers: [McpsService]
})
export class McpsModule {}
