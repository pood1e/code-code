import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionsCommandService } from '../sessions/sessions-command.service';
import { toChatSummary } from './chat-mapper';
import type { CreateChatDto, UpdateChatDto } from './dto/chat.dto';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsCommandService: SessionsCommandService
  ) {}

  async create(dto: CreateChatDto) {
    const session = await this.sessionsCommandService.create({
      scopeId: dto.scopeId,
      runnerId: dto.runnerId,
      skillIds: dto.skillIds ?? [],
      ruleIds: dto.ruleIds ?? [],
      mcps: dto.mcps ?? [],
      runnerSessionConfig: dto.runnerSessionConfig ?? {},
      initialMessage: dto.initialMessage
    });

    try {
      const chat = await this.prisma.chat.create({
        data: {
          scopeId: dto.scopeId,
          sessionId: session.id,
          title: dto.title ?? null
        },
        include: {
          session: true
        }
      });

      return toChatSummary(chat);
    } catch (error) {
      await this.cleanupFailedChatCreation(session.id);
      throw error;
    }
  }

  async list(scopeId?: string) {
    const chats = await this.prisma.chat.findMany({
      where: scopeId ? { scopeId } : {},
      include: {
        session: true
      }
    });

    return chats
      .slice()
      .sort(
        (left, right) =>
          right.session.updatedAt.getTime() - left.session.updatedAt.getTime()
      )
      .map(toChatSummary);
  }

  async getById(id: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        session: true
      }
    });

    if (!chat) {
      throw new NotFoundException(`Chat not found: ${id}`);
    }

    return toChatSummary(chat);
  }

  async update(id: string, dto: UpdateChatDto) {
    const existing = await this.prisma.chat.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Chat not found: ${id}`);
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one chat field must be provided');
    }

    const updated = await this.prisma.chat.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {})
      },
      include: {
        session: true
      }
    });

    return toChatSummary(updated);
  }

  async delete(id: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      throw new NotFoundException(`Chat not found: ${id}`);
    }

    // Dispose the underlying session first
    await this.sessionsCommandService.dispose(chat.sessionId);
    // Chat record is cascade-deleted via DB relation (Cascade on session delete)
  }

  private async cleanupFailedChatCreation(sessionId: string) {
    try {
      await this.sessionsCommandService.dispose(sessionId);
    } catch (cleanupError) {
      console.error(
        `[ChatsService] Failed to clean up session after chat creation error: ${sessionId}`,
        cleanupError
      );
    }
  }
}
