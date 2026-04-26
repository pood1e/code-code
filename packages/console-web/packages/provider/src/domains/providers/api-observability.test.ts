import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mutateProviderObservability,
  pullProviderObservability,
} from "./api-observability";

const { mutateSWRMock, jsonRequestMock } = vi.hoisted(() => ({
  mutateSWRMock: vi.fn(async () => undefined),
  jsonRequestMock: vi.fn(),
}));

vi.mock("swr", () => ({
  __esModule: true,
  default: vi.fn(),
  mutate: mutateSWRMock,
}));
vi.mock("@code-code/console-web-ui", () => ({
  jsonFetcher: vi.fn(),
  jsonRequest: jsonRequestMock,
}));

describe("api-observability", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates all observability keys immediately", async () => {
    await mutateProviderObservability();

    expect(mutateSWRMock).toHaveBeenCalledTimes(1);
    const immediateMatcher = mutateSWRMock.mock.calls[0]?.[0] as (key: unknown) => boolean;
    expect(immediateMatcher("/api/providers/observability/providers/a?window=1h&view=status")).toBe(true);
    expect(immediateMatcher("/api/providers/observability/providers/a?window=1h&view=card")).toBe(true);
    expect(immediateMatcher("/api/chats/chat-1")).toBe(false);
  });

  it("revalidates one provider immediately", async () => {
    await mutateProviderObservability("provider-1");

    expect(mutateSWRMock).toHaveBeenCalledTimes(1);
    const immediateMatcher = mutateSWRMock.mock.calls[0]?.[0] as (key: unknown) => boolean;
    expect(immediateMatcher("/api/providers/observability/summary?window=15m")).toBe(true);
    expect(immediateMatcher("/api/providers/observability/providers/provider-1?window=1h&view=status")).toBe(true);
    expect(immediateMatcher("/api/providers/observability/providers/provider-1?window=1h&view=card")).toBe(true);
    expect(immediateMatcher("/api/providers/observability/providers/provider-2?window=1h&view=card")).toBe(false);
  });

  it("pulls status and card views and writes both responses into SWR cache", async () => {
    const statusDetail = { providerId: "provider-1", items: [] };
    const cardDetail = { providerId: "provider-1", items: [{ runtimeMetrics: [] }] };
    jsonRequestMock.mockResolvedValueOnce(statusDetail);
    jsonRequestMock.mockResolvedValueOnce(cardDetail);

    await pullProviderObservability("provider-1");

    expect(jsonRequestMock).toHaveBeenNthCalledWith(
      1,
      "/api/providers/observability/providers/provider-1?window=1h&view=status",
    );
    expect(jsonRequestMock).toHaveBeenNthCalledWith(
      2,
      "/api/providers/observability/providers/provider-1?window=1h&view=card",
    );
    expect(mutateSWRMock).toHaveBeenNthCalledWith(
      1,
      "/api/providers/observability/providers/provider-1?window=1h&view=status",
      statusDetail,
      { revalidate: false },
    );
    expect(mutateSWRMock).toHaveBeenNthCalledWith(
      2,
      "/api/providers/observability/providers/provider-1?window=1h&view=card",
      cardDetail,
      { revalidate: false },
    );
  });
});
