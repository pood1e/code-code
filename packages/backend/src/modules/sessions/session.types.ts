import type { Prisma } from '@prisma/client';

export type SessionRow = Prisma.AgentSessionGetPayload<Record<string, never>>;
export type SessionMessageRow = Prisma.SessionMessageGetPayload<
  Record<string, never>
>;
export type SessionMetricRow = Prisma.SessionMetricGetPayload<Record<string, never>>;
export type SessionEventRow = Prisma.SessionEventGetPayload<Record<string, never>>;
