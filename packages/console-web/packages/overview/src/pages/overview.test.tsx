import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./overview";

vi.mock("../domains/overview/api", () => ({
  useOverviewProviderAccounts: vi.fn(),
}));
vi.mock("@code-code/console-web-credential", () => ({
  useCredentials: vi.fn(),
}));

const { useOverviewProviderAccounts } = await import("../domains/overview/api");
const { useCredentials } = await import("@code-code/console-web-credential");

describe("OverviewPage", () => {
  it("renders provider and credential readiness summaries", () => {
    vi.mocked(useOverviewProviderAccounts).mockReturnValue({
      providerAccounts: [{
        providerId: "account-1",
        displayName: "Anthropic",
        surfaces: [{
          surfaceId: "endpoint-1",
          status: {
            phase: 2,
            reason: "credential material is not ready",
          },
        }],
      }],
      isLoading: false,
      isError: false,
    });
    vi.mocked(useCredentials).mockReturnValue({
      credentials: [{
        credentialId: "cred-1",
        displayName: "Primary Key",
        status: {
          materialReady: false,
          reason: "backing secret missing",
        },
      }],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Theme>
          <OverviewPage />
        </Theme>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Operations Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Provider Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attention" })).toBeInTheDocument();
    expect(screen.getByText("Provider · Anthropic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Provider" })).toHaveAttribute("href", "/providers?account=account-1");
  });
});
