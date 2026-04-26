import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ProviderConnectSessionPhase } from "@code-code/agent-contract/platform/management/v1";
import { useProviderCLIs } from "@code-code/console-web-credential";
import { DialogBackFooterActions, StatusCallout, requestErrorMessage } from "@code-code/console-web-ui";
import { useProviderConnectSessionPolling, useProviderConnectSessionTerminal } from "../provider-connect-session-polling";
import { openOAuthAuthorizationUrlForFlow, openOAuthAuthorizationUrl } from "../provider-oauth-navigation";
import { providerAuthenticationModel } from "../provider-authentication-model";
import type { ProviderAuthenticationKind } from "../provider-authentication-model";
import { updateProviderAuthentication, useProviderConnectSession } from "../api";
import { ProviderAuthenticationApiKeyForm } from "./provider-authentication-api-key-form";
import { ProviderAuthenticationOAuthForm } from "./provider-authentication-oauth-form";

type Props = {
  providerId: string;
  vendorId?: string;
  cliId?: string;
  kind: ProviderAuthenticationKind;
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
};

type FormValues = {
  apiKey: string;
};

export function ProviderAuthenticationForm({
  providerId,
  vendorId,
  cliId,
  kind,
  onSuccess,
  onCancel,
}: Props) {
  const [errorMsg, setErrorMsg] = useState("");
  const [localSessionId, setLocalSessionId] = useState("");
  const methods = useForm<FormValues>({
    defaultValues: {
      apiKey: "",
    },
  });

  const { clis } = useProviderCLIs();
  const cli = useMemo(
    () => clis.find((item) => item.cliId === cliId),
    [cliId, clis]
  );
  const callbackDelivery = cli?.oauth?.codeFlow?.callbackDelivery;
  const model = useMemo(
    () => providerAuthenticationModel({ providerId, vendorId, kind }),
    [kind, providerId, vendorId]
  );

  const { session, error: sessionError, isLoading: isSessionLoading, mutate: mutateSession } = useProviderConnectSession(localSessionId || undefined);
  useProviderConnectSessionPolling(localSessionId || undefined, session, mutateSession);
  const { reset: resetSessionTerminalState } = useProviderConnectSessionTerminal({
    sessionId: localSessionId || undefined,
    session,
    shouldHandle: (nextSession) => {
      return nextSession.phase === ProviderConnectSessionPhase.SUCCEEDED && nextSession.provider != null;
    },
    onHandle: async () => {
      setErrorMsg("");
      await onSuccess();
    },
  });

  const missingAccountNotice = model.missingAccountNotice();
  if (missingAccountNotice) {
    return (
      <div>
        <ProviderAuthenticationStatusNotice
          notice={missingAccountNotice}
          onCancel={onCancel}
        />
      </div>
    );
  }

  const resetOAuthSessionState = async () => {
    resetSessionTerminalState();
    setErrorMsg("");
    setLocalSessionId("");
  };

  const submitApiKeyAuthentication = async (data: FormValues) => {
    setErrorMsg("");
    try {
      await updateProviderAuthentication(providerId, {
        case: "apiKey",
        value: {
          apiKey: data.apiKey,
        },
      });
      await onSuccess();
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to update authentication."));
    }
  };

  const startOAuthAuthentication = async () => {
    setErrorMsg("");
    try {
      const response = await updateProviderAuthentication(providerId, {
        case: "cliOauth",
        value: {},
      });
      if (response.outcome.case !== "session") {
        throw new Error("Provider authentication did not return a session.");
      }
      const nextSession = response.outcome.value;
      setLocalSessionId(nextSession.sessionId);
      openOAuthAuthorizationUrlForFlow(nextSession.authorizationUrl, cli?.oauth?.flow);
    } catch (error: unknown) {
      setErrorMsg(requestErrorMessage(error, "Failed to update authentication."));
    }
  };

  if (kind === "cliOAuth") {
    const oauthStartNotice = model.oauthStartNotice();
    return (
      <ProviderAuthenticationOAuthForm
        localSessionId={localSessionId}
        session={session}
        sessionLoading={isSessionLoading}
        sessionErrorMessage={requestErrorMessage(sessionError, "")}
        callbackDelivery={callbackDelivery}
        errorMsg={errorMsg}
        startNotice={oauthStartNotice}
        reauthorizeLabel={model.reauthorizeLabel()}
        onCancel={onCancel}
        onRetry={resetOAuthSessionState}
        onOpenAuthorization={() => {
          if (!session?.authorizationUrl) {
            return;
          }
          openOAuthAuthorizationUrl(session.authorizationUrl);
        }}
        onCallbackSubmitted={async () => {
          await mutateSession();
        }}
        onSubmitOAuth={startOAuthAuthentication}
      />
    );
  }

  const submitApiKey = methods.handleSubmit(async (data) => {
    await submitApiKeyAuthentication(data);
  });

  return (
    <ProviderAuthenticationApiKeyForm
      model={model}
      methods={methods}
      errorMsg={errorMsg}
      isSubmitting={methods.formState.isSubmitting}
      onSubmit={submitApiKey}
      onCancel={onCancel}
    />
  );
}

function ProviderAuthenticationStatusNotice({
  notice,
  onCancel,
}: {
  notice: { color: "red" | "gray"; message: string };
  onCancel: () => void;
}) {
  return (
    <div>
      <StatusCallout color={notice.color}>{notice.message}</StatusCallout>
      <DialogBackFooterActions mt="3" onCancel={onCancel} />
    </div>
  );
}
