import type { ResourceKind } from '@agent-workbench/shared';
import { ArrowLeft } from 'lucide-react';

import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@/components/ui/button';

import { MarkdownResourceForm } from './MarkdownResourceForm';
import { McpResourceForm } from './McpResourceForm';
import {
  toMarkdownFormValues,
  toMcpFormValues
} from './resource-edit.form';
import { useResourceEditPage } from './use-resource-edit-page';

type ResourceEditPageProps = {
  kind: ResourceKind;
};

export function ResourceEditPage({ kind }: ResourceEditPageProps) {
  const {
    config,
    contentError,
    formKey,
    initialValues,
    loading,
    onBack,
    resourceNotFound,
    saveMarkdown,
    saveMcp,
    title
  } = useResourceEditPage(kind);

  if (resourceNotFound) {
    return (
      <EmptyState
        title={`未找到 ${config.singularLabel}`}
        description="当前资源不存在或已被删除。"
        action={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  if (kind === 'mcps') {
    return (
      <McpResourceForm
        key={formKey}
        title={title}
        initialValues={toMcpFormValues(initialValues)}
        loading={loading}
        contentError={contentError}
        onBack={onBack}
        onSave={(values) => void saveMcp(values)}
      />
    );
  }

  return (
    <MarkdownResourceForm
      key={formKey}
      title={title}
      initialValues={toMarkdownFormValues(initialValues)}
      loading={loading}
      contentError={contentError}
      onBack={onBack}
      onSave={(values) => void saveMarkdown(values)}
    />
  );
}
