import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { McpsModule } from './modules/mcps/mcps.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RulesModule } from './modules/rules/rules.module';
import { SkillsModule } from './modules/skills/skills.module';
import { AgentRunnersModule } from './modules/agent-runners/agent-runners.module';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    SkillsModule,
    McpsModule,
    RulesModule,
    ProfilesModule,
    AgentRunnersModule
  ]
})
export class AppModule {}
