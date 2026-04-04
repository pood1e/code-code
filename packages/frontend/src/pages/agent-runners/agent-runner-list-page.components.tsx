import type { AgentRunnerSummary, RunnerTypeResponse } from '@agent-workbench/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { agentRunnerConfig } from '@/types/agent-runners';
import {
  formatDateTime,
  formatNullableDescription
} from '@/utils/format-display';

import { getRunnerTypeName } from './agent-runner.form';

type AgentRunnerActionHandlers = {
  onDelete: (runner: AgentRunnerSummary) => void;
  onEdit: (runnerId: string) => void;
};

type DeleteAgentRunnerDialogProps = {
  errorMessage: string | null;
  open: boolean;
  pending: boolean;
  runner: AgentRunnerSummary | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function createAgentRunnerColumns(
  runnerTypes: RunnerTypeResponse[],
  handlers: AgentRunnerActionHandlers
): Array<ColumnDef<AgentRunnerSummary>> {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => handlers.onEdit(row.original.id)}
          className="text-left font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.name}
        </button>
      )
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {getRunnerTypeName(runnerTypes, row.original.type)}
        </span>
      )
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {formatNullableDescription(row.original.description)}
        </p>
      )
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.updatedAt)}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      size: 108,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="outline"
            size="sm"
            aria-label={`编辑 ${row.original.name}`}
            title={`编辑 ${row.original.name}`}
            onClick={() => handlers.onEdit(row.original.id)}
          >
            <Pencil data-icon="inline-start" />
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${row.original.name}`}
            title={`删除 ${row.original.name}`}
            onClick={() => handlers.onDelete(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      )
    }
  ];
}

export function renderAgentRunnerMobileCard(
  agentRunner: AgentRunnerSummary,
  runnerTypes: RunnerTypeResponse[],
  handlers: AgentRunnerActionHandlers
) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handlers.onEdit(agentRunner.id)}
        className="text-left font-medium text-foreground transition-colors hover:text-primary"
      >
        {agentRunner.name}
      </button>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Type: {getRunnerTypeName(runnerTypes, agentRunner.type)}</p>
        <p>{formatNullableDescription(agentRunner.description)}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {formatDateTime(agentRunner.updatedAt)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`编辑 ${agentRunner.name}`}
            title={`编辑 ${agentRunner.name}`}
            onClick={() => handlers.onEdit(agentRunner.id)}
          >
            编辑
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`删除 ${agentRunner.name}`}
            title={`删除 ${agentRunner.name}`}
            onClick={() => handlers.onDelete(agentRunner)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeleteAgentRunnerDialog({
  errorMessage,
  open,
  pending,
  runner,
  onClose,
  onConfirm
}: DeleteAgentRunnerDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={
        runner
          ? `删除 ${runner.name}？`
          : `删除 ${agentRunnerConfig.singularLabel}？`
      }
      description="删除后不可恢复，相关配置将立即失效。"
      confirmLabel="删除"
      destructive
      pending={pending}
      errorMessage={errorMessage}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onConfirm={onConfirm}
    />
  );
}
