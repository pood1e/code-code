import type { UseFormReturn } from "react-hook-form";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import type { ProviderConnectOptionKind } from "../provider-connect-options";
import type { ProviderConnectDialogModel, ProviderConnectDialogOption } from "../provider-connect-dialog-model";
import {
  changeProviderConnectOption,
  resetProviderConnectDialogState,
  submitProviderConnectForm,
} from "../provider-connect-dialog-actions";
import type { ProviderConnectFormValues } from "../provider-connect-form-model";

type Params = {
  methods: UseFormReturn<ProviderConnectFormValues>;
  preferredOption?: ProviderConnectDialogOption;
  preferredOptionKind?: ProviderConnectOptionKind;
  selectedOption?: ProviderConnectDialogOption;
  dialogModel: ProviderConnectDialogModel;
  setLocalSessionId: (value: string) => void;
  setSubmitError: (value: string) => void;
  resetSessionTerminalState: () => void;
  onOpenChange: (open: boolean) => void;
  onConnectSessionChange: (sessionId?: string, optionKind?: ProviderConnectOptionKind) => void;
  onConnected: (provider: ProviderView) => Promise<void> | void;
  openOAuthAuthorization: (authorizationURL?: string, flow?: OAuthAuthorizationFlow) => void;
};

export function useProviderConnectDialogHandlers({
  methods,
  preferredOption,
  preferredOptionKind,
  selectedOption,
  dialogModel,
  setLocalSessionId,
  setSubmitError,
  resetSessionTerminalState,
  onOpenChange,
  onConnectSessionChange,
  onConnected,
  openOAuthAuthorization,
}: Params) {
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetProviderConnectDialogState({
        methods,
        preferredOption,
        setLocalSessionId,
        setSubmitError,
        resetSessionTerminalState,
        onConnectSessionChange,
      });
    }
    onOpenChange(nextOpen);
  };

  const handleConnectOptionChange = (connectOptionId: string) => {
    changeProviderConnectOption({
      connectOptionId,
      dialogModel,
      methods,
      setSubmitError,
    });
  };

  const handleSubmit = methods.handleSubmit(async (data) => {
    await submitProviderConnectForm({
      selectedOption,
      data,
      setSubmitError,
      setLocalSessionId,
      onConnectSessionChange,
      onConnected,
      openOAuthAuthorization,
    });
  });

  const handleSessionRetry = () => {
    resetProviderConnectDialogState({
      methods,
      preferredOption: preferredOption ?? selectedOption,
      nextOptionKind: preferredOptionKind,
      setLocalSessionId,
      setSubmitError,
      resetSessionTerminalState,
      onConnectSessionChange,
    });
  };

  return {
    handleDialogOpenChange,
    handleConnectOptionChange,
    handleSubmit,
    handleSessionRetry,
  };
}
