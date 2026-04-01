import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input } from 'antd';
import {
  type ResourceRecord,
  type ResourceKind
} from '@agent-workbench/shared';
import { useNavigate, useParams } from 'react-router-dom';

import {
  isNotFoundApiError,
  useErrorMessage
} from '../../api/client';
import {
  getResource,
  saveResourceByKind
} from '../../api/resources';
import { queryKeys } from '../../query/query-keys';
import { resourceConfigMap } from '../../types/resources';
import { isFormValidationError } from '../../utils/form';
import {
  resourceEditConfigMap,
  toEnvObject,
  type ResourceFormValues,
  type ResourceMutationPayload
} from './resource-edit.utils';
import {
  MarkdownContentField,
  McpContentFields,
  ResourceEditError,
  ResourceEditHeader,
  ResourceNotFoundState
} from './resource-edit.components';

type ResourceEditPageProps = {
  kind: ResourceKind;
};

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
  const editConfig = resourceEditConfigMap[kind];
  const isEditing = Boolean(id);
  const resourceQuery = useQuery({
    queryKey: id
      ? queryKeys.resources.detail(kind, id)
      : queryKeys.resources.details(),
    queryFn: () => getResource(kind, id!),
    enabled: isEditing
  });
  const resourceNotFound = isEditing && isNotFoundApiError(resourceQuery.error);

  useEffect(() => {
    if (!id) {
      form.resetFields();
      form.setFieldsValue(editConfig.createInitialValues());
      return;
    }

    const resource = resourceQuery.data;
    if (!resource) {
      return;
    }

    form.setFieldsValue(editConfig.toFormValues(resource));
  }, [editConfig, form, id, resourceQuery.data]);

  useEffect(() => {
    if (resourceQuery.error && !resourceNotFound) {
      handleError(resourceQuery.error);
    }
  }, [handleError, resourceNotFound, resourceQuery.error]);

  const saveMutation = useMutation<ResourceRecord, Error, ResourceMutationPayload>({
    mutationFn: (payload) => saveResourceByKind[kind](payload as never, id),
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
    let values: ResourceFormValues;

    try {
      values = await form.validateFields();
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }

      handleError(error);
      return;
    }

    setContentError(null);

    try {
      const { data, error } = editConfig.buildPayload(values);
      if (!data) {
        setContentError(error);
        return;
      }

      await saveMutation.mutateAsync(data);
    } catch (error) {
      handleError(error);
    }
  };
  const loading =
    (isEditing && (resourceQuery.isPending || resourceQuery.isFetching)) ||
    saveMutation.isPending;

  if (resourceNotFound) {
    return (
      <Card className="page-card">
        <ResourceNotFoundState
          kind={kind}
          onBack={() => {
            void navigate(config.path);
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="page-card" loading={loading}>
      <ResourceEditHeader
        title={title}
        loading={loading}
        onBack={() => {
          void navigate(config.path);
        }}
        onSave={() => {
          void submit();
        }}
      />

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

        {editConfig.contentMode === 'mcp' ? (
          <McpContentFields preview={mcpPreview} />
        ) : (
          <MarkdownContentField
            value={contentTextValue}
            onChange={(value) => {
              form.setFieldValue('contentText', value);
            }}
          />
        )}

        <ResourceEditError message={contentError} />
      </Form>
    </Card>
  );
}
