export type RunnerTypeCapabilities = {
  skill: boolean;
  rule: boolean;
  mcp: boolean;
};

// ---- Schema Field Descriptor protocol ----

export type SchemaFieldKind =
  | 'string'
  | 'url'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum';

export type SchemaFieldDescriptor = {
  name: string;
  label: string;
  description?: string;
  kind: SchemaFieldKind;
  required: boolean;
  defaultValue?: string | number | boolean;
  enumOptions?: Array<{ label: string; value: string | number }>;
  /** When set, the field value should be fetched from runner context (e.g. 'models'). */
  contextKey?: string;
};

export type SchemaDescriptor = {
  fields: SchemaFieldDescriptor[];
};

// ---- Legacy JSON Schema types (deprecated — remove after full migration) ----

/** @deprecated Use SchemaDescriptor instead */
export type RunnerConfigJsonSchemaProperty = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
};

/** @deprecated Use SchemaDescriptor instead */
export type RunnerConfigJsonSchema = {
  $schema?: string;
  type?: 'object';
  title?: string;
  description?: string;
  properties?: Record<string, RunnerConfigJsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type RunnerTypeMeta = {
  id: string;
  name: string;
  capabilities: RunnerTypeCapabilities;
};

export type RunnerTypeResponse = RunnerTypeMeta & {
  runnerConfigSchema: SchemaDescriptor;
  runnerSessionConfigSchema: SchemaDescriptor;
  inputSchema: SchemaDescriptor;
  taskConfigSchema: SchemaDescriptor;
  runtimeConfigSchema: SchemaDescriptor;
};

export type AgentRunnerSummary = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunnerDetail = AgentRunnerSummary & {
  runnerConfig: Record<string, unknown>;
};

export type CreateAgentRunnerInput = {
  name: string;
  description?: string | null;
  type: string;
  runnerConfig: Record<string, unknown>;
};

export type UpdateAgentRunnerInput = {
  name?: string;
  description?: string | null;
  runnerConfig?: Record<string, unknown>;
};

export type RunnerContext = Record<string, Array<{ label: string; value: string } | string>>;
