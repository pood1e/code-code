import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePipelineMutation } from '../hooks/use-pipeline-mutations';

const schema = z.object({
  name: z.string().min(1, '请填写 Pipeline 名称'),
  featureRequest: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

type Props = {
  scopeId: string;
  onCreated?: (pipelineId: string) => void;
};

export function PipelineCreateDialog({ scopeId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreatePipelineMutation(scopeId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    createMutation.mutate(
      {
        scopeId,
        name: values.name,
        featureRequest: values.featureRequest ?? null
      },
      {
        onSuccess: (pipeline) => {
          reset();
          setOpen(false);
          onCreated?.(pipeline.id);
        }
      }
    );
  }

  return (
    <>
      <Button
        id="create-pipeline-btn"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <Plus className="h-4 w-4" />
        新建 Pipeline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建新 Pipeline</DialogTitle>
          </DialogHeader>

          <form id="pipeline-create-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pipeline-name">Pipeline 名称</Label>
              <Input
                id="pipeline-name"
                placeholder="例如：用户搜索功能"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline-feature-request">
                功能需求描述{' '}
                <span className="text-muted-foreground font-normal">
                  （可选）
                </span>
              </Label>
              <Textarea
                id="pipeline-feature-request"
                placeholder="描述需要实现的功能需求，AI 将据此分解任务..."
                className="resize-none min-h-[90px]"
                {...register('featureRequest')}
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button
              id="pipeline-create-submit"
              type="submit"
              form="pipeline-create-form"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
