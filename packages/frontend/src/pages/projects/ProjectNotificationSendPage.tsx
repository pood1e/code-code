import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send, Terminal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  NotificationSeverity,
  type CreateNotificationMessageInput,
  type NotificationMessageReceipt
} from '@agent-workbench/shared';

import { toApiRequestError } from '@/api/client';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useSendNotificationMessage } from '@/features/notifications/hooks/use-notification-messages';

import { useProjectPageData } from './use-project-page-data';

const sendNotificationFormSchema = z.object({
  type: z.string().trim().min(1, '消息类型不能为空').max(100),
  title: z.string().trim().min(1, '消息标题不能为空').max(200),
  body: z.string().trim().min(1, '消息内容不能为空').max(4000),
  severity: z.nativeEnum(NotificationSeverity),
  metadataJson: z.string().refine(
    (value) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      } catch {
        return false;
      }
    },
    { message: '必须是合法 JSON，且顶层必须是对象' }
  )
});

type SendNotificationFormValues = z.infer<typeof sendNotificationFormSchema>;

const notificationSeverityOptions = [
  { value: NotificationSeverity.Info, label: 'Info' },
  { value: NotificationSeverity.Success, label: 'Success' },
  { value: NotificationSeverity.Warning, label: 'Warning' },
  { value: NotificationSeverity.Error, label: 'Error' }
] as const;

function buildSendNotificationFormValues(): SendNotificationFormValues {
  return {
    type: 'manual.test',
    title: '',
    body: '',
    severity: NotificationSeverity.Info,
    metadataJson: '{}'
  };
}

function buildSendNotificationInput(
  scopeId: string,
  values: SendNotificationFormValues
): CreateNotificationMessageInput {
  return {
    scopeId,
    type: values.type,
    title: values.title,
    body: values.body,
    severity: values.severity,
    metadata: JSON.parse(values.metadataJson) as Record<string, unknown>
  };
}

function ReceiptAlert({
  receipt,
  onViewNotifications,
  onGoToChannels
}: {
  receipt: NotificationMessageReceipt;
  onViewNotifications: () => void;
  onGoToChannels: () => void;
}) {
  const matchedChannels = receipt.createdTaskCount > 0;
  const title = matchedChannels ? '发送成功' : '未命中任何通道';
  const description = matchedChannels
    ? `已命中 ${receipt.createdTaskCount} 个通道，投递任务已经入队。`
    : '本次消息已被系统接收，但当前没有命中任何启用中的通道，因此没有生成通知任务。';
  const actionLabel = matchedChannels ? '查看记录' : '前往通知渠道';
  const handleAction = matchedChannels ? onViewNotifications : onGoToChannels;

  return (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          messageId: {receipt.messageId}
        </p>
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={handleAction}>
          {actionLabel}
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function ProjectNotificationSendPage() {
  const {
    id: projectId,
    project,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();
  const sendMutation = useSendNotificationMessage(projectId ?? undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<NotificationMessageReceipt | null>(null);
  const form = useForm<SendNotificationFormValues>({
    resolver: zodResolver(sendNotificationFormSchema),
    defaultValues: buildSendNotificationFormValues()
  });

  const handleReset = () => {
    form.reset(buildSendNotificationFormValues());
    setSubmitError(null);
    setReceipt(null);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!projectId) {
      return;
    }

    try {
      setSubmitError(null);
      const nextReceipt = await sendMutation.mutateAsync(
        buildSendNotificationInput(projectId, values)
      );
      setReceipt(nextReceipt);
    } catch (error) {
      setReceipt(null);
      setSubmitError(toApiRequestError(error).message);
    }
  });

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isNotFound) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  if (!projectId || !project) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">手工发送</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                向当前 Project 写入一条内部通知消息，系统会按通道过滤器匹配并创建投递任务。
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => goToProjectTab(projectId, 'notifications')}
            >
              前往通知记录
            </Button>
          </div>

          {receipt ? (
            <ReceiptAlert
              receipt={receipt}
              onViewNotifications={() => goToProjectTab(projectId, 'notifications')}
              onGoToChannels={() => goToProjectTab(projectId, 'channels')}
            />
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>发送失败</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <SurfaceCard>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  label="消息类型"
                  htmlFor="notification-type"
                  description="用于匹配通道过滤器，例如 session.completed 或 manual.test。"
                  error={form.formState.errors.type?.message}
                >
                  <Input id="notification-type" {...form.register('type')} />
                </FormField>

                <FormField
                  label="严重级别"
                  htmlFor="notification-severity"
                  error={form.formState.errors.severity?.message}
                >
                  <NativeSelect
                    id="notification-severity"
                    {...form.register('severity')}
                  >
                    {notificationSeverityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>

                <FormField
                  label="消息标题"
                  htmlFor="notification-title"
                  error={form.formState.errors.title?.message}
                  className="lg:col-span-2"
                >
                  <Input id="notification-title" {...form.register('title')} />
                </FormField>

                <FormField
                  label="消息内容"
                  htmlFor="notification-body"
                  error={form.formState.errors.body?.message}
                  className="lg:col-span-2"
                >
                  <Textarea
                    id="notification-body"
                    rows={6}
                    {...form.register('body')}
                  />
                </FormField>

                <FormField
                  label="Metadata（JSON）"
                  htmlFor="notification-metadata"
                  description="仅支持顶层对象；通道条件会基于 metadata 顶层字段匹配。"
                  error={form.formState.errors.metadataJson?.message}
                  className="lg:col-span-2"
                >
                  <Textarea
                    id="notification-metadata"
                    rows={8}
                    className="font-mono text-sm"
                    {...form.register('metadataJson')}
                  />
                </FormField>
              </div>
            </SurfaceCard>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={sendMutation.isPending}
              >
                重置
              </Button>
              <Button type="submit" disabled={sendMutation.isPending}>
                <Send className="mr-1.5 h-4 w-4" />
                发送消息
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
