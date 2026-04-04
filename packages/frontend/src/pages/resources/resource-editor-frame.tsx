import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { EditorToolbar } from '@/components/app/EditorToolbar';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ResourceEditorFrameProps = {
  children: ReactNode;
  contentError: string | null;
  loading: boolean;
  onBack: () => void;
  onSave: () => void;
  title: string;
};

type ResourceBasicsSectionProps = {
  descriptionError?: string;
  descriptionField: UseFormRegisterReturn<'description'>;
  nameField: UseFormRegisterReturn<'name'>;
  nameError?: string;
};

export function ResourceEditorFrame({
  children,
  contentError,
  loading,
  onBack,
  onSave,
  title
}: ResourceEditorFrameProps) {
  return (
    <div className="space-y-4">
      <EditorToolbar
        title={title}
        onBack={onBack}
        onSave={onSave}
        saveDisabled={loading}
      />

      {children}

      {contentError ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{contentError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function ResourceBasicsSection({
  descriptionError,
  descriptionField,
  nameField,
  nameError
}: ResourceBasicsSectionProps) {
  return (
    <SurfaceCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField label="Name" htmlFor="resource-name" error={nameError}>
          <Input id="resource-name" autoFocus {...nameField} />
        </FormField>

        <FormField
          label="Description"
          htmlFor="resource-description"
          error={descriptionError}
        >
          <Textarea id="resource-description" rows={4} {...descriptionField} />
        </FormField>
      </div>
    </SurfaceCard>
  );
}
