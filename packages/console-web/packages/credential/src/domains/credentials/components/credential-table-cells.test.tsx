import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CredentialStatusSchema, CredentialViewSchema } from "@code-code/agent-contract/platform/management/v1";
import { CredentialDetail } from "./credential-table-cells";

describe("CredentialDetail", () => {
  it("shows not ready status and reason for API key credentials", () => {
    const credential = create(CredentialViewSchema, {
      credentialId: "cred-1",
      displayName: "Primary Key",
      kind: "CREDENTIAL_KIND_API_KEY",
      status: create(CredentialStatusSchema, {
        materialReady: false,
        reason: "backing secret missing"
      })
    });

    render(<CredentialDetail credential={credential} kind="api-key" />);

    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.getByText("backing secret missing")).toBeInTheDocument();
  });

  it("shows account email and ready badge for OAuth credentials", () => {
    const credential = create(CredentialViewSchema, {
      credentialId: "cred-2",
      displayName: "CLI Login",
      kind: "CREDENTIAL_KIND_OAUTH",
      accountEmail: "dev@example.com",
      status: create(CredentialStatusSchema, {
        materialReady: true
      })
    });

    render(<CredentialDetail credential={credential} kind="oauth" />);

    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
