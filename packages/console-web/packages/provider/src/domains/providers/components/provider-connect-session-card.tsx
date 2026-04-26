import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import { submitOAuthCodeCallback } from "@code-code/console-web-credential";
import { providerConnectSessionModel } from "../provider-connect-session-model";
import { OAuthSessionCard } from "@code-code/console-web-ui";

type Props = {
  session?: Parameters<typeof providerConnectSessionModel>[0];
  isLoading: boolean;
  errorMessage: string;
  onOpenAuthorization: () => void;
  onRetry: () => void;
  callbackDelivery?: Pick<OAuthCallbackDelivery, "mode" | "callbackProviderId" | "providerRedirectUri">;
  onCallbackSubmitted?: () => Promise<void> | void;
};

export function ProviderConnectSessionCard({
  session,
  isLoading,
  errorMessage,
  onOpenAuthorization,
  onRetry,
  callbackDelivery,
  onCallbackSubmitted,
}: Props) {
  const sessionModel = providerConnectSessionModel(session);
  const status = sessionModel.status(errorMessage);
  const canSubmitCallback = sessionModel.canSubmitCallback(callbackDelivery);
  const authorizationHint = sessionModel.authorizationHint();
  const userCode = sessionModel.userCode();

  const submitManualCallback = async (callbackInput: string) => {
    const oauthSessionID = sessionModel.oauthSessionId();
    if (!oauthSessionID) {
      return;
    }
    await submitOAuthCodeCallback(oauthSessionID, callbackDelivery, callbackInput);
  };

  return (
    <OAuthSessionCard
      statusColor={status.color}
      statusMessage={status.message}
      isLoading={isLoading}
      hint={authorizationHint}
      manualCallback={{
        canSubmit: canSubmitCallback,
        onSubmitCallback: submitManualCallback,
        onSubmitted: onCallbackSubmitted,
      }}
      userCode={userCode}
      onOpenAuthorization={sessionModel.authorizationUrl() ? onOpenAuthorization : undefined}
      primaryAction={sessionModel.hideActions() ? undefined : {
        label: "Start Over",
        onClick: onRetry,
      }}
    />
  );
}
