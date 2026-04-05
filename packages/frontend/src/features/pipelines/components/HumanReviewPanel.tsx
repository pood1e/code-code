import { useEffect, useState } from 'react';
import { Loader2, Pencil, RefreshCw, SkipForward, SquareX } from 'lucide-react';

import {
  HumanReviewAction,
  type PipelineHumanReviewPayload
} from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useSubmitDecisionMutation } from '../hooks/use-pipeline-mutations';

type Props = {
  pipelineId: string;
  scopeId: string;
  review: PipelineHumanReviewPayload;
};

function formatJson(value: unknown) {
  if (value == null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
}

export function HumanReviewPanel({ pipelineId, scopeId, review }: Props) {
  const [comment, setComment] = useState(review.reviewerComment ?? '');
  const [editedOutputText, setEditedOutputText] = useState(
    formatJson(review.candidateOutput)
  );
  const [outputError, setOutputError] = useState<string | null>(null);
  const commentValue = comment.trim();
  const { mutate: submitDecision, isPending } = useSubmitDecisionMutation(
    pipelineId,
    scopeId
  );

  const supportsRetry = review.suggestedActions.includes(HumanReviewAction.Retry);
  const supportsEdit = review.suggestedActions.includes(
    HumanReviewAction.EditAndContinue
  );
  const supportsSkip = review.suggestedActions.includes(HumanReviewAction.Skip);
  const supportsTerminate = review.suggestedActions.includes(
    HumanReviewAction.Terminate
  );
  const canSubmitComment = commentValue.length > 0;

  useEffect(() => {
    setComment(review.reviewerComment ?? '');
    setEditedOutputText(formatJson(review.candidateOutput));
    setOutputError(null);
  }, [review]);

  function clearComment() {
    setComment('');
  }

  function handleRetry() {
    submitDecision(
      {
        action: HumanReviewAction.Retry,
        comment: commentValue || undefined
      },
      {
        onSuccess: clearComment
      }
    );
  }

  function handleEditAndContinue() {
    if (!supportsEdit) {
      return;
    }

    try {
      const editedOutput = JSON.parse(editedOutputText);
      setOutputError(null);
      submitDecision(
        {
          action: HumanReviewAction.EditAndContinue,
          comment: commentValue || undefined,
          editedOutput
        },
        {
          onSuccess: () => {
            clearComment();
            setEditedOutputText(formatJson(editedOutput));
          }
        }
      );
    } catch {
      setOutputError('结构化输出必须是合法 JSON。');
    }
  }

  function handleSkip() {
    if (!supportsSkip || !canSubmitComment) {
      return;
    }

    submitDecision(
      {
        action: HumanReviewAction.Skip,
        comment: commentValue
      },
      {
        onSuccess: clearComment
      }
    );
  }

  function handleTerminate() {
    if (!supportsTerminate || !canSubmitComment) {
      return;
    }

    submitDecision(
      {
        action: HumanReviewAction.Terminate,
        comment: commentValue
      },
      {
        onSuccess: clearComment
      }
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          等待人工审核
        </h3>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {review.summary}
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-amber-800 dark:text-amber-300">
          <span>原因: {review.reason}</span>
          {review.sourceStageKey ? <span>来源阶段: {review.sourceStageKey}</span> : null}
          {review.sourceAttemptId ? <span>Attempt: {review.sourceAttemptId}</span> : null}
          {review.sourceSessionId ? <span>Session: {review.sourceSessionId}</span> : null}
        </div>
      </div>

      <Textarea
        id={`review-comment-${pipelineId}`}
        placeholder="填写 reviewer comment；skip / terminate 必填，retry / edit_and_continue 可选。"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="min-h-[88px] resize-none bg-white text-xs dark:bg-background"
        disabled={isPending}
      />

      {supportsEdit ? (
        <div className="space-y-2">
          <Textarea
            id={`review-output-${pipelineId}`}
            placeholder="编辑结构化输出 JSON"
            value={editedOutputText}
            onChange={(event) => {
              setEditedOutputText(event.target.value);
              if (outputError) {
                setOutputError(null);
              }
            }}
            className="min-h-[220px] resize-y bg-white font-mono text-xs dark:bg-background"
            disabled={isPending}
          />
          {outputError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{outputError}</p>
          ) : null}
        </div>
      ) : null}

      {review.artifacts.length > 0 ? (
        <div className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">相关产物</p>
          {review.artifacts.map((artifact) => (
            <p key={artifact.artifactId}>
              {artifact.name}
              {artifact.artifactKey ? ` · ${artifact.artifactKey}` : ''}
              {artifact.attempt ? ` · Attempt ${artifact.attempt}` : ''}
              {artifact.version ? ` · v${artifact.version}` : ''}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {supportsRetry ? (
          <Button
            id={`retry-btn-${pipelineId}`}
            size="sm"
            onClick={handleRetry}
            disabled={isPending}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            重试
          </Button>
        ) : null}
        {supportsEdit ? (
          <Button
            id={`edit-and-continue-btn-${pipelineId}`}
            size="sm"
            variant="outline"
            onClick={handleEditAndContinue}
            disabled={isPending}
            className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="mr-1 h-3.5 w-3.5" />
            )}
            人工修正并继续
          </Button>
        ) : null}
        {supportsSkip ? (
          <Button
            id={`skip-btn-${pipelineId}`}
            size="sm"
            variant="outline"
            onClick={handleSkip}
            disabled={isPending || !canSubmitComment}
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <SkipForward className="mr-1 h-3.5 w-3.5" />
            )}
            跳过
          </Button>
        ) : null}
        {supportsTerminate ? (
          <Button
            id={`terminate-btn-${pipelineId}`}
            size="sm"
            variant="outline"
            onClick={handleTerminate}
            disabled={isPending || !canSubmitComment}
            className="flex-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <SquareX className="mr-1 h-3.5 w-3.5" />
            )}
            终止
          </Button>
        ) : null}
      </div>
    </div>
  );
}
