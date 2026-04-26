import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OAuthAuthorizationFlow,
  OAuthAuthorizationPhase,
  OAuthAuthorizationSessionStateSchema
} from "@code-code/agent-contract/credential/v1";
import { MemoryRouter } from "react-router-dom";
import { startOAuthSession } from "../api";
import { OAuthSessionDialog } from "./oauth-session-dialog";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    startOAuthSession: vi.fn()
  };
});
vi.mock("../../credentials/reference-data", () => ({
  listOAuthCLIs: (items: unknown[]) => items,
  useProviderCLIs: () => ({
    clis: [
      {
        cliId: "codex",
        displayName: "Codex",
        vendorId: "codex",
        oauth: {
          flow: OAuthAuthorizationFlow.CODE,
          recommended: true
        }
      },
      {
        cliId: "qwen",
        displayName: "Qwen",
        vendorId: "qwen",
        oauth: {
          flow: OAuthAuthorizationFlow.DEVICE,
          recommended: false
        }
      }
    ]
  })
}));

const startOAuthSessionMock = vi.mocked(startOAuthSession);

describe("OAuthSessionDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("starts one qwen device-flow session with typed enum input", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    startOAuthSessionMock.mockResolvedValueOnce(create(OAuthAuthorizationSessionStateSchema, {
      spec: { sessionId: "session-qwen-1" },
      status: {
        phase: OAuthAuthorizationPhase.PROCESSING,
        authorizationUrl: "https://chat.qwen.ai/device"
      }
    }));

    render(
      <MemoryRouter>
        <OAuthSessionDialog
          lockedCliId="qwen"
          title="Connect Qwen Credential"
          triggerLabel="Connect Qwen"
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect Qwen" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Codex Main"), { target: { value: "Qwen Main" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(startOAuthSessionMock).toHaveBeenCalledWith({
        cliId: "qwen",
        flow: OAuthAuthorizationFlow.DEVICE,
        targetCredentialId: "qwen-main",
        targetDisplayName: "Qwen Main"
      });
    });

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("https://chat.qwen.ai/device", "_blank", "noopener,noreferrer");
    });
  });
});
