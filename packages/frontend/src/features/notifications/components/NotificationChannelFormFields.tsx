import type { NotificationCapabilitySummary } from '@agent-workbench/shared';
import { type Control, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DynamicConfigFieldInput } from '@/features/sessions/components/DynamicConfigFieldInput';
import type {
  RunnerConfigField,
  SupportedRunnerConfigSchema
} from '@/lib/runner-config-schema';

import type { NotificationChannelFormValues } from '../notification-channel.form';

type NotificationChannelFormFieldsProps = {
  capabilities: NotificationCapabilitySummary[];
  form: UseFormReturn<NotificationChannelFormValues>;
  parsedConfigSchema: SupportedRunnerConfigSchema;
  selectedCapability?: NotificationCapabilitySummary;
  selectedCapabilityId: string;
};

function CapabilityConfigFields({
  capabilityId,
  control,
  fields
}: {
  capabilityId: string;
  control: Control<NotificationChannelFormValues>;
  fields: RunnerConfigField[];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      {fields.map((field) => (
        <DynamicConfigFieldInput
          key={`${capabilityId}-${field.name}`}
          control={control}
          field={field}
          namePrefix="config"
        />
      ))}
    </div>
  );
}

export function NotificationChannelFormFields({
  capabilities,
  form,
  parsedConfigSchema,
  selectedCapability,
  selectedCapabilityId
}: NotificationChannelFormFieldsProps) {
  const channelNameInputId = 'notification-channel-name';
  const capabilitySelectId = 'notification-channel-capability';
  const filterTextareaId = 'notification-channel-filter-json';
  const enabledCheckboxId = 'notification-channel-enabled';
  const errors = form.formState.errors;
  const hasAvailableCapabilities = capabilities.length > 0;
  const hasConfigFields =
    parsedConfigSchema.supported && parsedConfigSchema.fields.length > 0;

  return (
    <>
      <div className="space-y-1">
        <label htmlFor={channelNameInputId} className="text-sm font-medium">
          名称
        </label>
        <Input
          id={channelNameInputId}
          aria-label="名称"
          placeholder="例如：会话故障告警"
          {...form.register('name')}
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor={capabilitySelectId} className="text-sm font-medium">
          通知能力
        </label>
        <NativeSelect
          id={capabilitySelectId}
          aria-label="通知能力"
          {...form.register('capabilityId')}
          disabled={!hasAvailableCapabilities}
        >
          {!hasAvailableCapabilities ? (
            <option value="" disabled>
              暂无可用通知能力
            </option>
          ) : null}
          {capabilities.map((capability) => (
            <option key={capability.id} value={capability.id}>
              {capability.name}
            </option>
          ))}
        </NativeSelect>
        {selectedCapability ? (
          <p className="text-xs text-muted-foreground">
            {selectedCapability.description}
          </p>
        ) : null}
        {errors.capabilityId ? (
          <p className="text-xs text-destructive">
            {errors.capabilityId.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor={filterTextareaId} className="text-sm font-medium">
          消息过滤器（JSON）
        </label>
        <Textarea
          id={filterTextareaId}
          aria-label="消息过滤器（JSON）"
          placeholder='{"messageTypes":["session.*"]}'
          className="font-mono text-sm"
          rows={6}
          {...form.register('filterJson')}
        />
        <p className="text-xs text-muted-foreground">
          第一阶段通道配置由通知能力托管，当前只需要定义消息类型和条件过滤器。
        </p>
        {errors.filterJson ? (
          <p className="text-xs text-destructive">{errors.filterJson.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">能力配置</label>
        {hasConfigFields ? (
          <CapabilityConfigFields
            capabilityId={selectedCapabilityId}
            control={form.control}
            fields={parsedConfigSchema.fields}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            当前通知能力无需额外配置。
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={enabledCheckboxId}
          aria-label="启用"
          {...form.register('enabled')}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor={enabledCheckboxId} className="text-sm font-medium">
          启用
        </label>
      </div>
    </>
  );
}
