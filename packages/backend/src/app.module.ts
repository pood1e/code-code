import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { McpsModule } from './modules/mcps/mcps.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RulesModule } from './modules/rules/rules.module';
import { SkillsModule } from './modules/skills/skills.module';

@Module({
  imports: [PrismaModule, SkillsModule, McpsModule, RulesModule, ProfilesModule]
})
export class AppModule {}
