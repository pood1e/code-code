import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import { DataTable } from '@/components/app/DataTable';
import { ListPageToolbar } from '@/components/app/ListPageToolbar';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { agentRunnerConfig } from '@/types/agent-runners';

import {
  createAgentRunnerColumns,
  DeleteAgentRunnerDialog,
  renderAgentRunnerMobileCard
} from './agent-runner-list-page.components';
import { useAgentRunnerListPageState } from './use-agent-runner-list-page-state';

export function AgentRunnerListPage() {
  const {
    items,
    pendingDelete,
    deleteError,
    deletePending,
    loading,
    runnerTypes,
    searchValue,
    showToolbar,
    agentRunnersQuery,
    setSearchValue,
    openDeleteDialog,
    closeDeleteDialog,
    navigateToAgentRunnerCreate,
    navigateToAgentRunnerEdit,
    submitDelete
  } = useAgentRunnerListPageState();

  const actionHandlers = useMemo(
    () => ({
      onDelete: openDeleteDialog,
      onEdit: navigateToAgentRunnerEdit
    }),
    [navigateToAgentRunnerEdit, openDeleteDialog]
  );

  const columns = useMemo(
    () => createAgentRunnerColumns(runnerTypes, actionHandlers),
    [actionHandlers, runnerTypes]
  );

  return (
    <SurfaceCard>
      {showToolbar ? (
        <ListPageToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onRefresh={() => void agentRunnersQuery.refetch()}
          onCreate={navigateToAgentRunnerCreate}
          refreshPending={agentRunnersQuery.isFetching}
          refreshLabel={`刷新 ${agentRunnerConfig.pluralLabel}`}
          createLabel={`新建 ${agentRunnerConfig.singularLabel}`}
        />
      ) : null}

      <div className={showToolbar ? 'pt-4' : ''}>
        <DataTable
          columns={columns}
          data={items}
          isLoading={loading}
          emptyTitle={`暂无 ${agentRunnerConfig.pluralLabel}`}
          emptyDescription={agentRunnerConfig.emptyState}
          emptyAction={
            <Button onClick={navigateToAgentRunnerCreate}>
              <Plus data-icon="inline-start" />
              新建 {agentRunnerConfig.singularLabel}
            </Button>
          }
          mobileCardRenderer={(agentRunner) =>
            renderAgentRunnerMobileCard(
              agentRunner,
              runnerTypes,
              actionHandlers
            )
          }
        />
      </div>

      <DeleteAgentRunnerDialog
        open={Boolean(pendingDelete)}
        runner={pendingDelete}
        errorMessage={deleteError}
        pending={deletePending}
        onClose={closeDeleteDialog}
        onConfirm={submitDelete}
      />
    </SurfaceCard>
  );
}
