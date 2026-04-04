import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  getAgentRunner,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { isNotFoundApiError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { NOOP_QUERY_KEY, queryKeys } from '@/query/query-keys';
import { agentRunnerConfig } from '@/types/agent-runners';

import { buildAgentRunnerInitialValues } from './agent-runner.form';
import { AgentRunnerEditorContent } from './AgentRunnerEditorContent';

export function AgentRunnerEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const isEditing = Boolean(id);

  const runnerTypesQuery = useQuery({
    queryKey: queryKeys.agentRunnerTypes.all,
    queryFn: listAgentRunnerTypes
  });
  const agentRunnerQuery = useQuery({
    queryKey: id ? queryKeys.agentRunners.detail(id) : NOOP_QUERY_KEY,
    queryFn: () => getAgentRunner(id!),
    enabled: isEditing
  });
  const agentRunnerNotFound =
    isEditing && isNotFoundApiError(agentRunnerQuery.error);

  useEffect(() => {
    if (runnerTypesQuery.error) {
      handleError(runnerTypesQuery.error);
    }
  }, [handleError, runnerTypesQuery.error]);

  useEffect(() => {
    if (agentRunnerQuery.error && !agentRunnerNotFound) {
      handleError(agentRunnerQuery.error);
    }
  }, [agentRunnerNotFound, agentRunnerQuery.error, handleError]);

  if (agentRunnerNotFound) {
    return (
      <EmptyState
        title={`未找到 ${agentRunnerConfig.singularLabel}`}
        description="当前 AgentRunner 不存在或已被删除。"
        action={
          <Button
            variant="outline"
            onClick={() => void navigate(agentRunnerConfig.path)}
          >
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  if (runnerTypesQuery.isPending || (isEditing && agentRunnerQuery.isPending)) {
    return <PageLoadingSkeleton />;
  }

  if (runnerTypesQuery.error || !runnerTypesQuery.data) {
    return (
      <EmptyState
        title="无法加载 Runner Types"
        description="当前无法获取 RunnerType 注册信息，请刷新后重试。"
        action={
          <Button
            variant="outline"
            onClick={() => void runnerTypesQuery.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            重试
          </Button>
        }
      />
    );
  }

  if (runnerTypesQuery.data.length === 0) {
    return (
      <EmptyState
        title="暂无 Runner Type"
        description="后端当前没有注册任何 RunnerType，暂时无法创建 AgentRunner。"
        action={
          <Button
            variant="outline"
            onClick={() => void navigate(agentRunnerConfig.path)}
          >
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  if (isEditing && (agentRunnerQuery.error || !agentRunnerQuery.data)) {
    return <PageLoadingSkeleton />;
  }

  return (
    <AgentRunnerEditorContent
      key={`${id ?? 'new'}:${agentRunnerQuery.data?.updatedAt ?? 'draft'}`}
      runnerTypes={runnerTypesQuery.data}
      runnerId={id}
      initialValues={buildAgentRunnerInitialValues(
        runnerTypesQuery.data,
        agentRunnerQuery.data
      )}
      onBack={() => {
        void navigate(agentRunnerConfig.path);
      }}
    />
  );
}
