import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderAuthenticationSummary } from "./provider-authentication-summary";

describe("ProviderAuthenticationSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows API key authentication storage details", () => {
    render(<ProviderAuthenticationSummary providerCredentialId="cred-1" kind="apiKey" />);

    expect(screen.getByText("cred-1")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByText("Managed by auth service")).toBeInTheDocument();
  });

  it("shows CLI OAuth authentication storage details", () => {
    render(<ProviderAuthenticationSummary providerCredentialId="cred-2" kind="cliOAuth" />);

    expect(screen.getByText("cred-2")).toBeInTheDocument();
    expect(screen.getByText("CLI OAuth")).toBeInTheDocument();
    expect(screen.getByText("Managed by auth service")).toBeInTheDocument();
  });
});
