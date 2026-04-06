import type {
  AgentRunnerSummary,
  Profile
} from '@agent-workbench/shared';
import type { UseFormReturn } from 'react-hook-form';

import { CompactNativeSelect } from '@/components/ui/native-select';
import type { RunnerConfigField } from '@/lib/runner-config-schema';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';
import type { ThreadComposerDiscoveredOptions } from '@/features/chat/runtime/assistant-ui/components/thread-composer.config';

import { DynamicConfigFieldInput } from '../components/DynamicConfigFieldInput';

export function CreateSessionSetupBar({
  form,
  runners,
  profiles,
  selectedRunnerId,
  selectedProfileId,
  sessionConfigFields,
  runnerContext
}: {
  form: UseFormReturn<CreateSessionFormValues>;
  runners: AgentRunnerSummary[];
  profiles: Profile[];
  selectedRunnerId: string;
  selectedProfileId?: string;
  sessionConfigFields: RunnerConfigField[];
  runnerContext: ThreadComposerDiscoveredOptions | undefined;
}) {
  const hasSessionConfig = sessionConfigFields.length > 0;

  return (
    <section className="rounded-2xl border border-border/40 bg-muted/20 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <CompactNativeSelect
          aria-label="选择 AgentRunner"
          containerClassName="min-w-[8.75rem]"
          className="w-full whitespace-nowrap bg-background/80"
          value={selectedRunnerId}
          onChange={(event) =>
            form.setValue('runnerId', event.target.value, {
              shouldDirty: true
            })
          }
        >
          {runners.map((runner) => (
            <option key={runner.id} value={runner.id}>
              {runner.name}
            </option>
          ))}
        </CompactNativeSelect>

        <CompactNativeSelect
          aria-label="选择 Profile"
          containerClassName="min-w-[8.25rem]"
          className="w-full whitespace-nowrap bg-background/80"
          value={selectedProfileId ?? ''}
          onChange={(event) =>
            form.setValue('profileId', event.target.value, {
              shouldDirty: true
            })
          }
        >
          <option value="">Profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </CompactNativeSelect>
      </div>

      {hasSessionConfig ? (
        <div className="mt-3 border-t border-border/40 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            {sessionConfigFields.map((field) => (
              <DynamicConfigFieldInput
                key={field.name}
                field={field}
                namePrefix="runnerSessionConfig"
                control={form.control}
                discoveredOptions={runnerContext}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
