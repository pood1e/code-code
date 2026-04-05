import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

import { HumanDecisionAction } from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitDecisionMutation } from '../hooks/use-pipeline-mutations';

type Props = {
  pipelineId: string;
};

export function HumanReviewPanel({ pipelineId }: Props) {
  const [feedback, setFeedback] = useState('');
  const { mutate: submitDecision, isPending } =
    useSubmitDecisionMutation(pipelineId);

  function handleApprove() {
    submitDecision({ action: HumanDecisionAction.Approve });
  }

  function handleReject() {
    submitDecision({
      action: HumanDecisionAction.Reject,
      feedback: feedback.trim() || undefined
    });
    setFeedback('');
  }

  return (
    <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          等待人工审核
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          请审查生成的计划，选择批准继续或拒绝并提供反馈以重新分解。
        </p>
      </div>

      <Textarea
        id={`review-feedback-${pipelineId}`}
        placeholder="（可选）拒绝时请填写修改意见，例如：请调整任务粒度..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="text-xs resize-none min-h-[72px] bg-white dark:bg-background"
        disabled={isPending}
      />

      <div className="flex gap-2">
        <Button
          id={`approve-btn-${pipelineId}`}
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
          )}
          批准
        </Button>
        <Button
          id={`reject-btn-${pipelineId}`}
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isPending}
          className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 mr-1" />
          )}
          拒绝
        </Button>
      </div>
    </div>
  );
}
