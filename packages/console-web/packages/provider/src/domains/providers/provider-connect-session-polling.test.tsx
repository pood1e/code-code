import {
  act,
  renderHook } from "@testing-library/react";
import { ProviderConnectSessionPhase } from "@code-code/agent-contract/platform/management/v1";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProviderConnectSessionPolling } from "./provider-connect-session-polling";

describe("useProviderConnectSessionPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps polling when a session id exists but the session has not loaded", () => {
    vi.useFakeTimers();
    const mutateSession = vi.fn();

    renderHook(() => useProviderConnectSessionPolling("session-1", undefined, mutateSession, 1000));

    expect(mutateSession).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mutateSession).toHaveBeenCalledTimes(2);
  });

  it("does not poll terminal failed sessions", () => {
    vi.useFakeTimers();
    const mutateSession = vi.fn();
    const session = { phase: ProviderConnectSessionPhase.FAILED };

    renderHook(() => useProviderConnectSessionPolling("session-1", session, mutateSession, 1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mutateSession).not.toHaveBeenCalled();
  });
});
