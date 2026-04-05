import { useState } from 'react';
import { Loader2, Pencil, ThumbsDown, ThumbsUp } from 'lucide-react';

import { HumanDecisionAction } from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useSubmitDecisionMutation } from '../hooks/use-pipeline-mutations';

type Props = {
  pipelineId: string;
  scopeId: string;
};

export function HumanReviewPanel({ pipelineId, scopeId }: Props) {
  const [feedback, setFeedback] = useState('');
  const feedbackValue = feedback.trim();
  const { mutate: submitDecision, isPending } = useSubmitDecisionMutation(
    pipelineId,
    scopeId
  );

  const canSubmitFeedback = feedbackValue.length > 0;

  function handleApprove() {
    submitDecision({ action: HumanDecisionAction.Approve });
  }

  function handleModify() {
    if (!canSubmitFeedback) {
      return;
    }

    submitDecision({
      action: HumanDecisionAction.Modify,
      feedback: feedbackValue
    }, {
      onSuccess: () => {
        setFeedback('');
      }
    });
  }

  function handleReject() {
    if (!canSubmitFeedback) {
      return;
    }

    submitDecision({
      action: HumanDecisionAction.Reject,
      feedback: feedbackValue
    }, {
      onSuccess: () => {
        setFeedback('');
      }
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4 dark:border-amber-800 dark:bg-amber-900/10">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          等待人工审核
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          审查生成的计划。批准会直接完成流程；修改或拒绝必须附带明确反馈。
        </p>
      </div>

      <Textarea
        id={`review-feedback-${pipelineId}`}
        placeholder="修改或拒绝时请填写意见，例如：补充边界条件、重写 AC、重新分解任务..."
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        className="min-h-[88px] resize-none bg-white text-xs dark:bg-background"
        disabled={isPending}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          id={`approve-btn-${pipelineId}`}
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 bg-green-600 text-white hover:bg-green-700"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="mr-1 h-3.5 w-3.5" />
          )}
          批准
        </Button>
        <Button
          id={`modify-btn-${pipelineId}`}
          size="sm"
          variant="outline"
          onClick={handleModify}
          disabled={isPending || !canSubmitFeedback}
          className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Pencil className="mr-1 h-3.5 w-3.5" />
          )}
          修改
        </Button>
        <Button
          id={`reject-btn-${pipelineId}`}
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isPending || !canSubmitFeedback}
          className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="mr-1 h-3.5 w-3.5" />
          )}
          拒绝
        </Button>
      </div>
    </div>
  );
}
