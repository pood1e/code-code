export type ChatSummary = {
  id: string;
  scopeId: string;
  sessionId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateChatInput = {
  scopeId: string;
  runnerId: string;
  title?: string | null;
  skillIds: string[];
  ruleIds: string[];
  mcps: Array<{
    resourceId: string;
    configOverride?: Record<string, unknown>;
  }>;
  runnerSessionConfig: Record<string, unknown>;
  initialMessage?: {
    input: Record<string, unknown>;
    runtimeConfig?: Record<string, unknown>;
  };
};

export type UpdateChatInput = {
  title?: string | null;
};
