import type { ActivityMessage } from "@ag-ui/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  chatActivityRenderers,
  TurnActivityMessage,
  turnActivityDisplay,
} from "./chat-activity-renderers";

describe("chat activity renderers", () => {
  it("registers the AG-UI TURN activity renderer", () => {
    const renderer = chatActivityRenderers[0];
    const result = renderer.content.safeParse({
      id: "turn-1",
      displayPhase: "running",
      message: "Turn is running.",
      retryCount: 1,
      steps: [{ id: "prepare:auth", label: "Prepare auth", phase: "running" }],
    });

    expect(renderer.activityType).toBe("TURN");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retryCount).toBe(1);
      expect(result.data.steps?.[0]?.label).toBe("Prepare auth");
    }
  });

  it("formats terminal and retry progress without runtime ids", () => {
    const message: ActivityMessage = {
      id: "activity-1",
      role: "activity",
      activityType: "TURN",
      content: {
        id: "turn-1",
        runId: "run-secret",
        displayPhase: "failed",
        message: "Provider rejected request.",
        retryCount: 2,
      },
    };

    render(
      <TurnActivityMessage
        activityType={message.activityType}
        content={message.content}
        message={message}
        agent={undefined}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Failed");
    expect(status).toHaveTextContent("Provider rejected request.");
    expect(status).toHaveTextContent("Retry 2");
    expect(status).not.toHaveTextContent("run-secret");
  });

  it("renders workflow steps from AG-UI activity content", () => {
    const message: ActivityMessage = {
      id: "activity-1",
      role: "activity",
      activityType: "TURN",
      content: {
        id: "turn-1",
        displayPhase: "running",
        steps: [
          { id: "prepare:auth", label: "Prepare auth", phase: "succeeded" },
          { id: "execute", label: "Execute prompt", phase: "running", message: "Run is active." },
        ],
      },
    };

    render(
      <TurnActivityMessage
        activityType={message.activityType}
        content={message.content}
        message={message}
        agent={undefined}
      />,
    );

    expect(screen.getByText("Prepare auth")).toBeInTheDocument();
    expect(screen.getByText("Execute prompt")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
  });

  it("keeps unknown phases readable", () => {
    expect(turnActivityDisplay({
      id: "turn-1",
      phase: "reload_skill",
    }).label).toBe("Reload skill");
  });
});
