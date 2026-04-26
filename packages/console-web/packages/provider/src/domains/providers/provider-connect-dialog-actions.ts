import type { UseFormReturn } from "react-hook-form";
import { requestErrorMessage } from "@code-code/console-web-ui";
import type { OAuthAuthorizationFlow } from "@code-code/agent-contract/credential/v1";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { confirmProviderAPIKeyConnect, startProviderOAuthConnect } from "./provider-connect-submit-model";
import type { ProviderConnectDialogModel, ProviderConnectDialogOption } from "./provider-connect-dialog-model";
import { defaultProviderConnectFormValues, type ProviderConnectFormValues } from "./provider-connect-form-model";
import { isAPIKeyConnectOption, type ProviderConnectOptionKind } from "./provider-connect-options";

type ResetProviderConnectDialogStateParams = {
  methods: UseFormReturn<ProviderConnectFormValues>;
  preferredOption?: ProviderConnectDialogOption;
  nextOptionKind?: ProviderConnectOptionKind;
  setLocalSessionId: (value: string) => void;
  setSubmitError: (value: string) => void;
  resetSessionTerminalState: () => void;
  onConnectSessionChange: (sessionId?: string, optionKind?: ProviderConnectOptionKind) => void;
};

export function resetProviderConnectDialogState({
  methods,
  preferredOption,
  nextOptionKind,
  setLocalSessionId,
  setSubmitError,
  resetSessionTerminalState,
  onConnectSessionChange,
}: ResetProviderConnectDialogStateParams) {
  methods.reset(defaultProviderConnectFormValues(preferredOption));
  setLocalSessionId("");
  setSubmitError("");
  resetSessionTerminalState();
  onConnectSessionChange(undefined, nextOptionKind);
}

type ChangeProviderConnectOptionParams = {
  connectOptionId: string;
  dialogModel: ProviderConnectDialogModel;
  methods: UseFormReturn<ProviderConnectFormValues>;
  setSubmitError: (value: string) => void;
};

export function changeProviderConnectOption({
  connectOptionId,
  dialogModel,
  methods,
  setSubmitError,
}: ChangeProviderConnectOptionParams) {
  const nextOption = dialogModel.option(connectOptionId);
  if (!nextOption) {
    return;
  }
  setSubmitError("");
  methods.reset(defaultProviderConnectFormValues(nextOption));
}

type SubmitProviderConnectFormParams = {
  selectedOption: ProviderConnectDialogOption | undefined;
  data: ProviderConnectFormValues;
  setSubmitError: (value: string) => void;
  setLocalSessionId: (value: string) => void;
  onConnectSessionChange: (sessionId?: string, optionKind?: ProviderConnectOptionKind) => void;
  onConnected: (provider: ProviderView) => Promise<void> | void;
  openOAuthAuthorization: (authorizationURL?: string, flow?: OAuthAuthorizationFlow) => void;
};

export async function submitProviderConnectForm({
  selectedOption,
  data,
  setSubmitError,
  setLocalSessionId,
  onConnectSessionChange,
  onConnected,
  openOAuthAuthorization,
}: SubmitProviderConnectFormParams) {
  if (!selectedOption) {
    return;
  }
  setSubmitError("");
  try {
    if (isAPIKeyConnectOption(selectedOption)) {
      const provider = await confirmProviderAPIKeyConnect(selectedOption, data);
      if (provider) {
        await onConnected(provider);
      }
      return;
    }
    const oauth = await startProviderOAuthConnect(selectedOption, data);
    const sessionId = oauth.session.sessionId;
    setLocalSessionId(sessionId);
    onConnectSessionChange(sessionId, oauth.optionKind);
    openOAuthAuthorization(oauth.session.authorizationUrl, oauth.flow);
  } catch (error: unknown) {
    setSubmitError(requestErrorMessage(error, "Failed to connect provider."));
  }
}
