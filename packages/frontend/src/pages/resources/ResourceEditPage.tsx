import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import {
  mcpInputSchema,
  ruleInputSchema,
  skillInputSchema,
  type McpResource,
  type ResourceKind
} from '@agent-workbench/shared';
import { useNavigate, useParams } from 'react-router-dom';

import { useErrorMessage } from '../../api/client';
import {
  createResource,
  getResource,
  updateResource,
  type ResourcePayloadByKind
} from '../../api/resources';
import { CodeEditor } from '../../components/JsonEditor';
import { queryKeys } from '../../query/query-keys';
import { resourceConfigMap } from '../../types/resources';

type EnvEntry = {
  key: string;
  value: string;
};

type ResourceFormValues = {
  name: string;
  description?: string;
  contentText?: string;
  type?: 'stdio';
  command?: string;
  args?: string[];
  envEntries?: EnvEntry[];
};

type ResourceEditPageProps = {
  kind: ResourceKind;
};

function createInitialValues(kind: ResourceKind): ResourceFormValues {
  if (kind === 'mcps') {
    return {
      name: '',
      description: '',
      type: 'stdio',
      command: '',
      args: [],
      envEntries: []
    };
  }

  return {
    name: '',
    description: '',
    contentText: ''
  };
}

function toEnvEntries(env?: Record<string, string>): EnvEntry[] {
  if (!env) {
    return [];
  }

  return Object.entries(env).map(([key, value]) => ({ key, value }));
}

function toEnvObject(entries?: EnvEntry[]) {
  const result = (entries ?? []).reduce<Record<string, string>>(
    (acc, entry) => {
      const key = entry.key.trim();
      if (!key) {
        return acc;
      }

      acc[key] = entry.value;
      return acc;
    },
    {}
  );

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeDescription(description?: string) {
  return description?.trim() ? description.trim() : null;
}

type ResourceMutationPayload = ResourcePayloadByKind[ResourceKind];

async function saveResourceByKind(
  kind: ResourceKind,
  payload: ResourceMutationPayload,
  id?: string
) {
  switch (kind) {
    case 'skills':
      return id
        ? updateResource('skills', id, payload as ResourcePayloadByKind['skills'])
        : createResource('skills', payload as ResourcePayloadByKind['skills']);
    case 'mcps':
      return id
        ? updateResource('mcps', id, payload as ResourcePayloadByKind['mcps'])
        : createResource('mcps', payload as ResourcePayloadByKind['mcps']);
    case 'rules':
      return id
        ? updateResource('rules', id, payload as ResourcePayloadByKind['rules'])
        : createResource('rules', payload as ResourcePayloadByKind['rules']);
  }
}

export function ResourceEditPage({ kind }: ResourceEditPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [form] = Form.useForm<ResourceFormValues>();
  const [contentError, setContentError] = useState<string | null>(null);
  const contentTextValue = Form.useWatch('contentText', form) ?? '';
  const commandValue = Form.useWatch('command', form) ?? '';
  const rawArgsValue = Form.useWatch('args', form);
  const rawEnvEntriesValue = Form.useWatch('envEntries', form);

  const config = resourceConfigMap[kind];
  const isEditing = Boolean(id);
  const isMcp = kind === 'mcps';
  const resourceQuery = useQuery({
    queryKey: id ? queryKeys.resources.detail(kind, id) : queryKeys.resources.details(),
    queryFn: () => getResource(kind, id!),
    enabled: isEditing
  });

  useEffect(() => {
    if (!id) {
      form.resetFields();
      form.setFieldsValue(createInitialValues(kind));
      return;
    }

    const resource = resourceQuery.data;
    if (!resource) {
      return;
    }

    if (typeof resource.content === 'string') {
      form.setFieldsValue({
        name: resource.name,
        description: resource.description ?? '',
        contentText: resource.content
      });
      return;
    }

    const mcpResource = resource as McpResource;
    form.setFieldsValue({
      name: mcpResource.name,
      description: mcpResource.description ?? '',
      type: mcpResource.content.type,
      command: mcpResource.content.command,
      args: mcpResource.content.args,
      envEntries: toEnvEntries(mcpResource.content.env)
    });
  }, [form, id, resourceQuery.data, kind]);

  useEffect(() => {
    if (resourceQuery.error) {
      handleError(resourceQuery.error);
    }
  }, [handleError, resourceQuery.error]);

  const saveMutation = useMutation({
    mutationFn: (payload: ResourceMutationPayload) =>
      saveResourceByKind(kind, payload, id),
    onSuccess: async (resource) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.resources.lists()
        }),
        queryClient.setQueryData(
          queryKeys.resources.detail(kind, resource.id),
          resource
        )
      ]);
      void navigate(config.path);
    }
  });

  const title = useMemo(
    () => `${isEditing ? 'Edit' : 'Create'} ${config.singularLabel}`,
    [config.singularLabel, isEditing]
  );

  const mcpPreview = useMemo(() => {
    const argsValue = rawArgsValue ?? [];
    const envEntriesValue = rawEnvEntriesValue ?? [];
    const preview = {
      type: 'stdio' as const,
      command: commandValue.trim(),
      args: argsValue.map((item) => item.trim()).filter(Boolean),
      env: toEnvObject(envEntriesValue)
    };

    return JSON.stringify(
      preview.env
        ? preview
        : { type: preview.type, command: preview.command, args: preview.args },
      null,
      2
    );
  }, [commandValue, rawArgsValue, rawEnvEntriesValue]);

  const submit = async () => {
    const values = await form.validateFields();
    setContentError(null);

    try {
      if (isMcp) {
        const parsed = mcpInputSchema.safeParse({
          name: values.name,
          description: normalizeDescription(values.description),
          content: {
            type: 'stdio',
            command: values.command?.trim() ?? '',
            args: (values.args ?? [])
              .map((item) => item.trim())
              .filter(Boolean),
            env: toEnvObject(values.envEntries)
          }
        });

        if (!parsed.success) {
          setContentError(
            parsed.error.issues[0]?.message ?? 'Invalid MCP content.'
          );
          return;
        }
        await saveMutation.mutateAsync(parsed.data);
      } else {
        const payload = {
          name: values.name,
          description: normalizeDescription(values.description),
          content: values.contentText ?? ''
        };
        const schema = kind === 'skills' ? skillInputSchema : ruleInputSchema;
        const parsed = schema.safeParse(payload);

        if (!parsed.success) {
          setContentError(
            parsed.error.issues[0]?.message ?? 'Invalid Markdown content.'
          );
          return;
        }
        await saveMutation.mutateAsync(parsed.data);
      }
    } catch (error) {
      handleError(error);
    }
  };
  const loading = resourceQuery.isPending || saveMutation.isPending;

  return (
    <Card className="page-card" loading={loading}>
      <div className="page-card__header">
        <div>
          <Typography.Title level={2} className="page-card__title">
            {title}
          </Typography.Title>
          <Typography.Paragraph className="page-card__description">
            编辑内容
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={() => void navigate(config.path)}>Back</Button>
          <Button
            type="primary"
            onClick={() => void submit()}
            loading={loading}
          >
            Save
          </Button>
        </Space>
      </div>

      <Form<ResourceFormValues> layout="vertical" form={form}>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: `${config.singularLabel} name is required`
            }
          ]}
        >
          <Input placeholder={`${config.singularLabel} name`} />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea placeholder="描述" rows={3} />
        </Form.Item>

        {isMcp ? (
          <>
            <Form.Item label="Type" name="type" initialValue="stdio">
              <Input disabled />
            </Form.Item>
            <Form.Item
              label="Command"
              name="command"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Command is required'
                }
              ]}
            >
              <Input placeholder="npx" />
            </Form.Item>
            <Form.List name="args">
              {(fields, { add, remove }) => (
                <Form.Item label="Args">
                  <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size={12}
                  >
                    {fields.map((field) => (
                      <Space
                        key={field.key}
                        style={{ display: 'flex' }}
                        align="start"
                      >
                        <Form.Item
                          {...field}
                          style={{ marginBottom: 0, minWidth: 320 }}
                          rules={[
                            {
                              required: true,
                              whitespace: true,
                              message: 'Argument is required'
                            }
                          ]}
                        >
                          <Input placeholder="Argument" />
                        </Form.Item>
                        <Button onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      </Space>
                    ))}
                    <Button onClick={() => add('')}>Add Arg</Button>
                  </Space>
                </Form.Item>
              )}
            </Form.List>
            <Form.List name="envEntries">
              {(fields, { add, remove }) => (
                <Form.Item label="Env">
                  <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size={12}
                  >
                    {fields.map((field) => (
                      <Space
                        key={field.key}
                        style={{ display: 'flex' }}
                        align="start"
                      >
                        <Form.Item
                          name={[field.name, 'key']}
                          style={{ marginBottom: 0, minWidth: 200 }}
                        >
                          <Input placeholder="KEY" />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'value']}
                          style={{ marginBottom: 0, minWidth: 240 }}
                        >
                          <Input placeholder="VALUE" />
                        </Form.Item>
                        <Button onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      </Space>
                    ))}
                    <Button onClick={() => add({ key: '', value: '' })}>
                      Add Env
                    </Button>
                  </Space>
                </Form.Item>
              )}
            </Form.List>
            <Form.Item label="JSON Preview">
              <CodeEditor
                value={mcpPreview}
                onChange={() => undefined}
                readOnly
                mode="json"
              />
            </Form.Item>
          </>
        ) : (
          <Form.Item label="Content" name="contentText">
            <CodeEditor
              value={contentTextValue}
              onChange={(value) => {
                form.setFieldValue('contentText', value);
              }}
              mode="markdown"
            />
          </Form.Item>
        )}

        {contentError ? (
          <Alert type="error" showIcon message={contentError} />
        ) : null}
      </Form>
    </Card>
  );
}
