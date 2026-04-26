import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddProviderDialog } from "./add-provider-dialog";
import { useProviderConnectSession } from "../api";

const resetSessionTerminalStateMock = vi.fn();

vi.mock("../api", () => ({
  useProviderConnectSession: vi.fn(),
}));

vi.mock("@code-code/console-web-credential", () => ({
  useProviderCLIs: () => ({
    clis: [],
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: vi.fn(),
  }),
  useProviderVendors: () => ({
    vendors: [],
    isLoading: false,
    isError: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("../provider-connect-session-polling", () => ({
  useProviderConnectSessionPolling: vi.fn(),
  useProviderConnectSessionTerminal: () => ({ reset: resetSessionTerminalStateMock }),
}));

vi.mock("./provider-connect-dialog-body", () => ({
  ProviderConnectDialogBody: ({ onSessionCallbackSubmitted }: { onSessionCallbackSubmitted: () => Promise<void> }) => (
    <>
      <button type="button" onClick={() => void onSessionCallbackSubmitted()}>
        submit-callback
      </button>
    </>
  ),
}));

const useProviderConnectSessionMock = vi.mocked(useProviderConnectSession);

describe("AddProviderDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes after manual OAuth callback URL submission", async () => {
    const mutateSession = vi.fn(async () => undefined);
    const onOpenChange = vi.fn();
    const onConnectSessionChange = vi.fn();
    useProviderConnectSessionMock.mockReturnValue({
      session: {
        sessionId: "session-1",
        oauthSessionId: "oauth-session-1",
        authorizationUrl: "https://auth.example/authorize",
        cliId: "codex",
      },
      error: undefined,
      isLoading: false,
      isError: false,
      mutate: mutateSession,
    });

    render(
      <Theme>
        <AddProviderDialog
          open
          connectSessionId="session-1"
          preferredOptionKind="cliOAuth"
          onOpenChange={onOpenChange}
          onConnectSessionChange={onConnectSessionChange}
          onConnected={vi.fn()}
        />
      </Theme>
    );

    fireEvent.click(screen.getByRole("button", { name: "submit-callback" }));

    await waitFor(() => {
      expect(mutateSession).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConnectSessionChange).not.toHaveBeenCalled();
  });
});
