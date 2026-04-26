import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { ProviderConnectSessionPhase, type ProviderView } from "@code-code/agent-contract/platform/management/v1";
import {
  useProviderCLIs,
  useProviderVendors,
} from "@code-code/console-web-credential";
import { Dialog } from "@radix-ui/themes";
import {
  useProviderConnectSession,
} from "../api";
import {
  listProviderConnectOptions,
  type ProviderConnectOptionKind,
} from "../provider-connect-options";
import {
  providerConnectDialogModel,
  resolveProviderConnectOptionsError,
} from "../provider-connect-dialog-model";
import { openOAuthAuthorizationUrl, openOAuthAuthorizationUrlForFlow } from "../provider-oauth-navigation";
import {
  useProviderConnectSessionPolling,
  useProviderConnectSessionTerminal,
} from "../provider-connect-session-polling";
import { ProviderConnectDialogBody } from "./provider-connect-dialog-body";
import { useProviderConnectDialogHandlers } from "./use-provider-connect-dialog-handlers";
import { useProviderConnectDialogState } from "./use-provider-connect-dialog-state";
import {
  defaultProviderConnectFormValues,
  type ProviderConnectFormValues,
} from "../provider-connect-form-model";

type Props = {
  open: boolean;
  connectSessionId?: string;
  preferredOptionKind?: ProviderConnectOptionKind;
  onOpenChange: (open: boolean) => void;
  onConnectSessionChange: (sessionId?: string, optionKind?: ProviderConnectOptionKind) => void;
  onConnected: (provider: ProviderView) => Promise<void> | void;
};

export function AddProviderDialog({
  open,
  connectSessionId,
  preferredOptionKind,
  onOpenChange,
  onConnectSessionChange,
  onConnected,
}: Props) {
  const { vendors, isLoading: isVendorLoading, isError: isVendorError, error: vendorError, mutate: mutateVendors } = useProviderVendors();
  const { clis, isLoading: isCLILoading, isError: isCLIError, error: cliError, mutate: mutateCLIs } = useProviderCLIs();
  const connectOptions = useMemo(
    () => listProviderConnectOptions(vendors, clis),
    [clis, vendors]
  );
  const dialogModel = useMemo(
    () => providerConnectDialogModel(connectOptions, preferredOptionKind),
    [connectOptions, preferredOptionKind],
  );
  const preferredOption = dialogModel.preferredOption();
  const scopedConnectOptions = dialogModel.scopedOptions();
  const dialogCopy = dialogModel.copy();
  const methods = useForm<ProviderConnectFormValues>({
    defaultValues: defaultProviderConnectFormValues(preferredOption),
  });
  const {
    localSessionId,
    setLocalSessionId,
    submitError,
    setSubmitError,
    selectedOption,
  } = useProviderConnectDialogState({
    connectSessionId,
    open,
    methods,
    dialogModel,
    preferredOption,
    scopedConnectOptions,
  });
  const { session, error: sessionError, isLoading: isSessionLoading, mutate: mutateSession } = useProviderConnectSession(localSessionId || undefined);
  const sessionCallbackDelivery = useMemo(() => {
    const cliId = session?.cliId?.trim() || "";
    if (!cliId) {
      return undefined;
    }
    return clis.find((item) => item.cliId === cliId)?.oauth?.codeFlow?.callbackDelivery;
  }, [clis, session?.cliId]);
  const { reset: resetSessionTerminalState } = useProviderConnectSessionTerminal({
    sessionId: localSessionId || undefined,
    session,
    shouldHandle: (nextSession) => nextSession.phase === ProviderConnectSessionPhase.SUCCEEDED && nextSession.provider != null,
    onHandle: (nextSession) => {
      const provider = nextSession.provider;
      if (!provider) {
        return;
      }
      return onConnected(provider);
    },
  });
  const connectOptionsError = resolveProviderConnectOptionsError(vendorError, cliError, isVendorError || isCLIError);
  const {
    handleDialogOpenChange,
    handleConnectOptionChange,
    handleSubmit,
    handleSessionRetry,
  } = useProviderConnectDialogHandlers({
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
    openOAuthAuthorization: (authorizationURL, flow) => {
      openOAuthAuthorizationUrlForFlow(authorizationURL, flow);
    },
  });

  useProviderConnectSessionPolling(localSessionId || undefined, session, mutateSession);

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{dialogCopy.title}</Dialog.Title>
        <ProviderConnectDialogBody
          isLoading={isVendorLoading || isCLILoading}
          optionsError={connectOptionsError}
          onRetry={() => {
            void mutateVendors();
            void mutateCLIs();
          }}
          copy={dialogCopy}
          scopedConnectOptions={scopedConnectOptions}
          sessionId={localSessionId}
          session={session}
          isSessionLoading={isSessionLoading}
          sessionError={sessionError}
          sessionCallbackDelivery={sessionCallbackDelivery}
          onSessionCallbackSubmitted={async () => {
            await mutateSession();
          }}
          onOpenAuthorization={() => {
            openOAuthAuthorizationUrl(session?.authorizationUrl);
          }}
          onSessionRetry={handleSessionRetry}
          selectedOption={selectedOption}
          submitError={submitError}
          methods={methods}
          onFormSubmit={handleSubmit}
          onConnectOptionChange={handleConnectOptionChange}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
}
