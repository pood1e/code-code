import type { ComponentProps } from 'react';

import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { CodeEditor } from '@/components/JsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import type { OverrideEditorState } from './profile-editor.form';
export { ResourceSectionCard } from './profile-resource-section';

export function ProfileSummaryCard({
  nameInputId,
  descriptionInputId,
  nameError,
  descriptionError,
  formRegister
}: {
  nameInputId: string;
  descriptionInputId: string;
  nameError?: string;
  descriptionError?: string;
  formRegister: {
    name: ComponentProps<typeof Input>;
    description: ComponentProps<typeof Textarea>;
  };
}) {
  return (
    <SurfaceCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField label="Name" htmlFor={nameInputId} error={nameError}>
          <Input id={nameInputId} autoFocus {...formRegister.name} />
        </FormField>
        <FormField
          label="Description"
          htmlFor={descriptionInputId}
          error={descriptionError}
        >
          <Textarea
            id={descriptionInputId}
            rows={4}
            {...formRegister.description}
          />
        </FormField>
      </div>
    </SurfaceCard>
  );
}

export function McpOverrideEditorCard({
  expanded,
  editorState,
  onToggleExpanded,
  onChange
}: {
  expanded: boolean;
  editorState: OverrideEditorState;
  onToggleExpanded: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">MCP Override</p>
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded}>
          {expanded ? '收起 override' : '编辑 override'}
        </Button>
      </div>
      {expanded ? (
        <div className="space-y-3">
          <CodeEditor value={editorState.value} onChange={onChange} />
          {editorState.error ? (
            <p className="text-sm text-destructive">{editorState.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
