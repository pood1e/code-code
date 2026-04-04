import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ResourceKind, ResourceRecord } from '@agent-workbench/shared';
import { useNavigate, useParams } from 'react-router-dom';

import { isNotFoundApiError } from '@/api/client';
import { getResource, saveResourceByKind } from '@/api/resources';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { resourceConfigMap } from '@/types/resources';

import {
  resourceEditConfigMap,
  type ResourceFormValues,
  type ResourceMarkdownFormValues,
  type ResourceMcpFormValues,
  type ResourceMutationPayload
} from './resource-edit.form';

type MarkdownPayload = Parameters<typeof saveResourceByKind.skills>[0];
type McpPayload = Parameters<typeof saveResourceByKind.mcps>[0];

export function useResourceEditPage(kind: ResourceKind) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [contentError, setContentError] = useState<string | null>(null);

  const config = resourceConfigMap[kind];
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
    if (resourceQuery.error && !resourceNotFound) {
      handleError(resourceQuery.error);
    }
  }, [handleError, resourceNotFound, resourceQuery.error]);

  const saveMutation = useMutation<
    ResourceRecord,
    Error,
    ResourceMutationPayload
  >({
    mutationFn: (payload) => saveResourcePayload(kind, payload, id),
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

  const initialValues = useMemo<ResourceFormValues>(() => {
    if (resourceQuery.data) {
      return resourceEditConfigMap[kind].toFormValues(resourceQuery.data);
    }

    return resourceEditConfigMap[kind].createInitialValues();
  }, [kind, resourceQuery.data]);

  const loading =
    (isEditing && (resourceQuery.isPending || resourceQuery.isFetching)) ||
    saveMutation.isPending;

  const saveMarkdown = async (values: ResourceMarkdownFormValues) => {
    await saveResourceForm(resourceEditConfigMap[kind].buildPayload(values));
  };

  const saveMcp = async (values: ResourceMcpFormValues) => {
    await saveResourceForm(resourceEditConfigMap.mcps.buildPayload(values));
  };

  const saveResourceForm = async (result: {
    data: ResourceMutationPayload | null;
    error: string | null;
  }) => {
    setContentError(null);

    if (!result.data) {
      setContentError(result.error);
      return;
    }

    try {
      await saveMutation.mutateAsync(result.data);
    } catch (error) {
      handleError(error);
    }
  };

  return {
    config,
    contentError,
    formKey: resourceQuery.data
      ? `${resourceQuery.data.id}:${resourceQuery.data.updatedAt}`
      : 'new',
    initialValues,
    loading,
    onBack: () => void navigate(config.path),
    resourceNotFound,
    saveMarkdown,
    saveMcp,
    title: `${isEditing ? '编辑' : '新建'} ${config.singularLabel}`
  };
}

function isMcpPayload(payload: ResourceMutationPayload): payload is McpPayload {
  return typeof payload.content !== 'string';
}

function isMarkdownPayload(
  payload: ResourceMutationPayload
): payload is MarkdownPayload {
  return typeof payload.content === 'string';
}

function saveResourcePayload(
  kind: ResourceKind,
  payload: ResourceMutationPayload,
  id?: string
) {
  if (kind === 'mcps') {
    if (!isMcpPayload(payload)) {
      throw new Error('Invalid MCP payload.');
    }

    return saveResourceByKind.mcps(payload, id);
  }

  if (!isMarkdownPayload(payload)) {
    throw new Error('Invalid markdown payload.');
  }

  return kind === 'skills'
    ? saveResourceByKind.skills(payload, id)
    : saveResourceByKind.rules(payload, id);
}
