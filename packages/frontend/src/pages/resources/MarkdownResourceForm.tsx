import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { CodeEditor } from '@/components/JsonEditor';

import {
  resourceMarkdownFormSchema,
  type ResourceMarkdownFormValues
} from './resource-edit.form';
import {
  ResourceBasicsSection,
  ResourceEditorFrame
} from './resource-editor-frame';

type MarkdownResourceFormProps = {
  contentError: string | null;
  initialValues: ResourceMarkdownFormValues;
  loading: boolean;
  onBack: () => void;
  onSave: (values: ResourceMarkdownFormValues) => void;
  title: string;
};

export function MarkdownResourceForm({
  contentError,
  initialValues,
  loading,
  onBack,
  onSave,
  title
}: MarkdownResourceFormProps) {
  const form = useForm<ResourceMarkdownFormValues>({
    resolver: zodResolver(resourceMarkdownFormSchema),
    defaultValues: initialValues
  });

  return (
    <ResourceEditorFrame
      contentError={contentError}
      loading={loading}
      onBack={onBack}
      onSave={() => void form.handleSubmit(onSave)()}
      title={title}
    >
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <ResourceBasicsSection
          descriptionError={form.formState.errors.description?.message}
          descriptionField={form.register('description')}
          nameField={form.register('name')}
          nameError={form.formState.errors.name?.message}
        />

        <SurfaceCard>
          <Controller
            control={form.control}
            name="contentText"
            render={({ field }) => (
              <FormField
                label="Content"
                error={form.formState.errors.contentText?.message}
              >
                <CodeEditor
                  mode="markdown"
                  onChange={field.onChange}
                  value={field.value}
                />
              </FormField>
            )}
          />
        </SurfaceCard>
      </form>
    </ResourceEditorFrame>
  );
}
