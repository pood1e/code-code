import type { AbstractAgent } from "@ag-ui/client";
import type { ActivityMessage } from "@ag-ui/core";
import type { ReactActivityMessageRenderer } from "@copilotkit/react-core/v2";
import { z } from "zod";

const TURN_ACTIVITY_TYPE = "TURN";

const turnActivityStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  phase: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

const turnActivityContentSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  runId: z.string().optional(),
  phase: z.string().optional(),
  displayPhase: z.string().optional(),
  message: z.string().optional(),
  canStop: z.boolean().optional(),
  canRetry: z.boolean().optional(),
  retryCount: z.number().optional(),
  attemptCount: z.number().optional(),
  candidateIndex: z.number().optional(),
  failureClass: z.string().optional(),
  steps: z.array(turnActivityStepSchema).optional(),
}).passthrough();

export type TurnActivityContent = z.infer<typeof turnActivityContentSchema>;
export type TurnActivityStep = z.infer<typeof turnActivityStepSchema>;

type TurnActivityTone = "pending" | "running" | "complete" | "danger" | "muted";

export type TurnActivityMessageProps = {
  activityType: string;
  content: TurnActivityContent;
  message: ActivityMessage;
  agent: AbstractAgent | undefined;
};

const PHASE_LABELS: Record<string, string> = {
  accepted: "Queued",
  pending: "Queued",
  queued: "Queued",
  preparing: "Preparing",
  running: "Running",
  retrying: "Retrying",
  stopping: "Stopping",
  succeeded: "Complete",
  complete: "Complete",
  failed: "Failed",
  canceled: "Canceled",
  cancelled: "Canceled",
  stopped: "Stopped",
};

export function TurnActivityMessage({ content }: TurnActivityMessageProps) {
  const display = turnActivityDisplay(content);

  return (
    <div
      className="chatActivityMessage"
      data-tone={display.tone}
      role="status"
      aria-live={display.tone === "danger" ? "assertive" : "polite"}
    >
      <span className="chatActivityDot" aria-hidden="true" />
      <span className="chatActivityLabel">{display.label}</span>
      {display.detail ? (
        <span className="chatActivityDetail">{display.detail}</span>
      ) : null}
      {display.meta ? (
        <span className="chatActivityMeta">{display.meta}</span>
      ) : null}
      {display.steps.length ? (
        <span className="chatActivitySteps">
          {display.steps.map((step) => (
            <span
              key={step.id}
              className="chatActivityStep"
              data-tone={step.tone}
              title={step.message}
            >
              <span>{step.label}</span>
              <span className="chatActivityStepPhase">{step.phaseLabel}</span>
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

export function turnActivityDisplay(content: TurnActivityContent) {
  const phase = normalizePhase(content.displayPhase || content.phase);
  const label = PHASE_LABELS[phase] || humanizePhase(content.displayPhase || content.phase);
  return {
    label,
    tone: turnActivityTone(phase, content.failureClass),
    detail: activityDetail(content.message, label),
    meta: activityMeta(content),
    steps: activitySteps(content.steps),
  };
}

function normalizePhase(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function humanizePhase(value: string | undefined) {
  const cleaned = (value || "Working").trim().replace(/[_-]+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function turnActivityTone(phase: string, failureClass: string | undefined): TurnActivityTone {
  if (phase === "failed" || failureClass) {
    return "danger";
  }
  if (phase === "succeeded" || phase === "complete") {
    return "complete";
  }
  if (phase === "canceled" || phase === "cancelled" || phase === "stopped") {
    return "muted";
  }
  if (phase === "running" || phase === "preparing" || phase === "stopping") {
    return "running";
  }
  return "pending";
}

function activityDetail(message: string | undefined, label: string) {
  const detail = message?.trim();
  if (!detail || detail.toLowerCase() === label.toLowerCase()) {
    return "";
  }
  return detail;
}

function activityMeta(content: TurnActivityContent) {
  const parts: string[] = [];
  if (content.attemptCount && content.attemptCount > 1) {
    parts.push(`Attempt ${content.attemptCount}`);
  }
  if (content.retryCount && content.retryCount > 0) {
    parts.push(`Retry ${content.retryCount}`);
  }
  return parts.join(" · ");
}

function activitySteps(steps: TurnActivityStep[] | undefined) {
  return (steps || [])
    .filter((step) => step.id.trim() && step.label.trim())
    .map((step) => {
      const phase = normalizePhase(step.phase);
      return {
        id: step.id,
        label: step.label.trim(),
        phaseLabel: PHASE_LABELS[phase] || humanizePhase(step.phase),
        tone: turnActivityTone(phase, ""),
        message: step.message?.trim(),
      };
    });
}

export const chatActivityRenderers: ReactActivityMessageRenderer<TurnActivityContent>[] = [{
  activityType: TURN_ACTIVITY_TYPE,
  content: turnActivityContentSchema,
  render: TurnActivityMessage,
}];
