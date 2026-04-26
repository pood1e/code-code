import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCredential } from "../api";
import { CredentialFormDialog } from "./credential-form-dialog";

vi.mock("../api", () => ({
  createCredential: vi.fn()
}));
vi.mock("../reference-data", () => ({
  listManualCredentialVendorOptions: (items: unknown[]) => items,
  useProviderVendors: () => ({
    vendors: [
      {
        vendor: {
          vendorId: "openai",
          displayName: "OpenAI"
        },
        providerSurfaces: [{}]
      }
    ]
  })
}));

const createCredentialMock = vi.mocked(createCredential);

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "New Manual Credential" }));
}

function fillBaseFields() {
  fireEvent.change(screen.getByPlaceholderText("e.g. OpenAI Production Key"), {
    target: { value: "OpenAI Production Key" }
  });
}

describe("CredentialFormDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("clears submission errors when the dialog is reopened", async () => {
    createCredentialMock.mockRejectedValueOnce(new Error("Create failed"));

    render(<CredentialFormDialog />);

    openDialog();
    fillBaseFields();
    fireEvent.change(screen.getByPlaceholderText("Enter API key"), {
      target: { value: "sk-test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Create failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    openDialog();

    expect(screen.queryByText("Create failed")).not.toBeInTheDocument();
  });

  it("does not submit unmounted auth fields after credential kind changes", async () => {
    createCredentialMock.mockResolvedValueOnce(undefined);

    render(<CredentialFormDialog />);

    openDialog();
    fillBaseFields();

    fireEvent.change(screen.getByPlaceholderText("Enter API key"), {
      target: { value: "sk-test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createCredentialMock).toHaveBeenCalledTimes(1);
    });

    expect(createCredentialMock).toHaveBeenCalledWith({
      credentialId: "openai-production-key",
      displayName: "OpenAI Production Key",
      kind: "CREDENTIAL_KIND_API_KEY",
      purpose: "CREDENTIAL_PURPOSE_UNSPECIFIED",
      vendorId: "",
      cliId: "",
      material: {
        case: "apiKeyMaterial",
        value: {
          apiKey: "sk-test",
        }
      }
    });
  });
});
