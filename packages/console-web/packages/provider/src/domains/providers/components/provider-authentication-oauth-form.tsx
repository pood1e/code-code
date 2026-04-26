import { Flex } from "@radix-ui/themes";
import { type ProviderConnectSessionView } from "@code-code/agent-contract/platform/management/v1";
import { DialogBackFooterActions, DialogBackSubmitFooterActions, ErrorCalloutIf, StatusCallout } from "@code-code/console-web-ui";
import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import { ProviderConnectSessionCard } from "./provider-connect-session-card";

import type { ProviderAuthenticationNotice } from "../provider-authentication-model";

type Props = {
  localSessionId: string;
  session?: ProviderConnectSessionView;
  sessionLoading: boolean;
  sessionErrorMessage: string;
  callbackDelivery?: Pick<OAuthCallbackDelivery, "mode" | "callbackProviderId" | "providerRedirectUri">;
  errorMsg: string;
  startNotice: ProviderAuthenticationNotice | null;
  reauthorizeLabel: string;
  onCancel: () => void;
  onRetry: () => Promise<void>;
  onOpenAuthorization: () => void;
  onCallbackSubmitted: () => Promise<void>;
  onSubmitOAuth: () => Promise<void>;
};

export function ProviderAuthenticationOAuthForm({
  localSessionId,
  session,
  sessionLoading,
  sessionErrorMessage,
  callbackDelivery,
  errorMsg,
  startNotice,
  reauthorizeLabel,
  onCancel,
  onRetry,
  onOpenAuthorization,
  onCallbackSubmitted,
  onSubmitOAuth,
}: Props) {
  if (localSessionId) {
    return (
      <Flex direction="column" gap="4">
        <ErrorCalloutIf error={errorMsg} />
        <ProviderConnectSessionCard
          session={session}
          isLoading={sessionLoading}
          errorMessage={sessionErrorMessage}
          callbackDelivery={callbackDelivery}
          onCallbackSubmitted={onCallbackSubmitted}
          onOpenAuthorization={onOpenAuthorization}
          onRetry={onRetry}
        />
        <DialogBackFooterActions onCancel={onCancel} />
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="4">
      {startNotice ? (
      <StatusCallout color={startNotice.color}>{startNotice.message}</StatusCallout>
      ) : null}
      <ErrorCalloutIf error={errorMsg} />
      <DialogBackSubmitFooterActions
        onCancel={onCancel}
        submitText={reauthorizeLabel}
        onSubmit={onSubmitOAuth}
      />
    </Flex>
  );
}
