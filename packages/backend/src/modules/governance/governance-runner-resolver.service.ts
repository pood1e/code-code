import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GovernanceRunnerResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRunnerId() {
    const runner = await this.prisma.agentRunner.findFirst({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true }
    });

    return runner?.id ?? null;
  }
}
