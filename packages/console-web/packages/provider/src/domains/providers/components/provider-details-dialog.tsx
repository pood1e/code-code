import { useState } from "react";
import { Dialog } from "@radix-ui/themes";
import type { ProviderSurface } from "@code-code/agent-contract/provider/v1";
import type { CLI } from "@code-code/agent-contract/platform/support/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { Vendor } from "@code-code/agent-contract/platform/support/v1";
import { requestErrorMessage } from "@code-code/console-web-ui";
import { deleteProvider, updateProvider } from "../api";
import { providerModel } from "../provider-model";
import { providerSurfaceRuntimeCLIID } from "../provider-surface-binding-view";
import { providerObservabilityAuthPresentation } from "../provider-observability-auth-presentation";
import { providerSupportsActiveQuery } from "../provider-observability-visualization";
import { ProviderAuthenticationView } from "./provider-authentication-view";
import { ProviderDetailsView } from "./provider-details-view";
import { ProviderObservabilityAuthenticationView } from "./provider-observability-authentication-view";
import { ProviderRenameView } from "./provider-rename-view";

type Props = {
  provider: ProviderView | null;
  clis: CLI[];
  surfaces: ProviderSurface[];
  vendors: Vendor[];
  onClose: () => void;
  onUpdated?: () => void;
  onProbeActiveQuery: (provider: ProviderView) => void;
  probingProviderId?: string;
};

export function ProviderDetailsDialog({
  provider,
  clis,
  surfaces,
  vendors,
  onClose,
  onUpdated,
  onProbeActiveQuery,
  probingProviderId,
}: Props) {
  const [view, setView] = useState<"details" | "rename" | "authentication" | "observabilityAuthentication">("details");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const providerViewModel = provider ? providerModel(provider) : null;
  const normalizedRenameValue = renameValue.trim();
  const providerDisplayName = provider?.displayName?.trim() || "";
  const canSaveRename = providerViewModel
    ? normalizedRenameValue !== "" && normalizedRenameValue !== providerDisplayName
    : false;
  const authenticationKind = providerViewModel?.authenticationKind() || "apiKey";
  const supportsActiveQuery = provider ? providerSupportsActiveQuery(provider, clis, vendors) : false;
  const observabilityAuth = providerObservabilityAuthPresentation(provider?.vendorId);
  const showDedicatedObservabilityAuthentication = authenticationKind === "apiKey" && supportsActiveQuery && Boolean(observabilityAuth?.separateProviderUpdate);

  const handleClose = () => {
    setView("details");
    setDeleteError("");
    setIsDeleting(false);
    setRenameError("");
    setRenameValue("");
    setIsRenaming(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!provider) {
      return;
    }
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteProvider(provider.providerId);
      handleClose();
      onUpdated?.();
    } catch (error: unknown) {
      setDeleteError(requestErrorMessage(error, "Delete failed. Please try again."));
      setIsDeleting(false);
    }
  };

  const handleRenameSave = async () => {
    if (!provider || !canSaveRename) {
      return;
    }
    setRenameError("");
    setIsRenaming(true);
    try {
      await updateProvider(provider.providerId, normalizedRenameValue);
      handleClose();
      onUpdated?.();
    } catch (error: unknown) {
      setRenameError(requestErrorMessage(error, "Rename failed. Please try again."));
      setIsRenaming(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
    }
  };

  const handleStartRename = () => {
    setRenameValue(provider?.displayName || "");
    setRenameError("");
    setView("rename");
  };

  const handleStartAuthentication = () => {
    setView("authentication");
  };

  const handleStartObservabilityAuthentication = () => {
    setView("observabilityAuthentication");
  };

  const handleRenameSubmit = () => {
    void handleRenameSave();
  };
  const handleDeleteSubmit = () => {
    void handleDelete();
  };

  return (
    <Dialog.Root open={provider !== null} onOpenChange={handleOpenChange}>
      <Dialog.Content maxWidth="640px">
        {provider && view === "details" ? (
          <ProviderDetailsView
            provider={provider}
            authenticationKind={authenticationKind}
            surfaces={surfaces}
            supportsActiveQuery={supportsActiveQuery}
            isProbingActiveQuery={probingProviderId === provider.providerId}
            deleteError={deleteError}
            isDeleting={isDeleting}
            observabilityAuthenticationActionLabel={observabilityAuth?.providerActionLabel}
            onClose={handleClose}
            onDelete={handleDeleteSubmit}
            onStartRename={handleStartRename}
            onStartAuthentication={handleStartAuthentication}
            onStartObservabilityAuthentication={handleStartObservabilityAuthentication}
            onProbeActiveQuery={() => onProbeActiveQuery(provider)}
            showObservabilityAuthenticationAction={showDedicatedObservabilityAuthentication}
          />
        ) : null}

        {provider && view === "rename" ? (
          <ProviderRenameView
            renameValue={renameValue}
            renameError={renameError}
            isRenaming={isRenaming}
            canSaveRename={canSaveRename}
            onRenameValueChange={setRenameValue}
            onBack={() => setView("details")}
            onSubmit={handleRenameSubmit}
          />
        ) : null}

        {provider && providerViewModel && view === "authentication" ? (
          <ProviderAuthenticationView
            provider={provider}
            authenticationKind={authenticationKind}
            cliId={providerSurfaceRuntimeCLIID(providerViewModel.primarySurface()?.runtime)}
            onSuccess={() => {
              setView("details");
              onUpdated?.();
            }}
            onCancel={() => setView("details")}
          />
        ) : null}

        {provider && observabilityAuth && view === "observabilityAuthentication" ? (
          <ProviderObservabilityAuthenticationView
            provider={provider}
            onSuccess={() => {
              setView("details");
              onUpdated?.();
            }}
            onCancel={() => setView("details")}
          />
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
