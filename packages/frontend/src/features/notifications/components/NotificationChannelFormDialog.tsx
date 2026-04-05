import { AlertTriangle } from 'lucide-react';

import type {
  NotificationCapabilitySummary,
  NotificationChannelSummary
} from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import { NotificationChannelFormFields } from './NotificationChannelFormFields';
import { useNotificationChannelForm } from '../hooks/use-notification-channel-form';

type NotificationChannelFormDialogProps = {
  open: boolean;
  onClose: () => void;
  scopeId: string;
  capabilities: NotificationCapabilitySummary[];
  editing?: NotificationChannelSummary;
};

export function NotificationChannelFormDialog({
  open,
  onClose,
  scopeId,
  capabilities,
  editing
}: NotificationChannelFormDialogProps) {
  const {
    form,
    handleClose,
    handleSubmit,
    isEdit,
    parsedConfigSchema,
    saveDisabled,
    selectedCapability,
    selectedCapabilityId,
    submitError
  } = useNotificationChannelForm({
    capabilities,
    editing,
    onClose,
    open,
    scopeId
  });
  const dialogTitle = isEdit ? '编辑通道' : '创建通道';
  const submitLabel = isEdit ? '保存' : '创建';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            配置通知通道的名称、能力、过滤器和能力参数。
          </DialogDescription>
        </DialogHeader>

        <form
          id="channel-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <NotificationChannelFormFields
            capabilities={capabilities}
            form={form}
            parsedConfigSchema={parsedConfigSchema}
            selectedCapability={selectedCapability}
            selectedCapabilityId={selectedCapabilityId}
          />

          {submitError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {submitError}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            form="channel-form"
            type="submit"
            disabled={saveDisabled}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
