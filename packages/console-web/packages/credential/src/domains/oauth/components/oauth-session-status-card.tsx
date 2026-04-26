import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { DialogFooterActions, OAuthSessionCard, StatusBadge, openExternalUrl } from "@code-code/console-web-ui";
import {
  OAuthCallbackMode,
  OAuthAuthorizationPhase,
  type OAuthAuthorizationSessionState,
} from "@code-code/agent-contract/credential/v1";
import { submitOAuthCodeCallback } from "../api";
import { getOAuthPhaseLabel, isDeviceFlowSession } from "../oauth-phase";

type OAuthSessionStatusCardProps = {
  session: OAuthAuthorizationSessionState;
  onCancel: () => Promise<void>;
  onBack: () => void;
  isCancelling?: boolean;
  callbackDelivery?: Pick<OAuthCallbackDelivery, "mode" | "callbackProviderId" | "providerRedirectUri">;
  onCallbackSubmitted?: () => Promise<void> | void;
};

export function OAuthSessionStatusCard({
  session,
  onCancel,
  onBack,
  isCancelling = false,
  callbackDelivery,
  onCallbackSubmitted,
}: OAuthSessionStatusCardProps) {
  const phase = session.status?.phase;
  const isDeviceFlow = isDeviceFlowSession(session);
  const badgeColor = phase === OAuthAuthorizationPhase.SUCCEEDED
    ? "green"
    : phase === OAuthAuthorizationPhase.FAILED
      || phase === OAuthAuthorizationPhase.EXPIRED
      || phase === OAuthAuthorizationPhase.CANCELED
      ? "red"
      : "amber";
  const isActive = phase === OAuthAuthorizationPhase.PENDING
    || phase === OAuthAuthorizationPhase.AWAITING_USER
    || phase === OAuthAuthorizationPhase.PROCESSING;
  const phaseLabel = getOAuthPhaseLabel(phase || OAuthAuthorizationPhase.UNSPECIFIED);
  const canSubmitCallback = isActive
    && callbackDelivery?.mode === OAuthCallbackMode.LOCALHOST_RELAY
    && Boolean(session.spec?.sessionId);

  const submitManualCallback = async (callbackInput: string) => {
    if (!session.spec?.sessionId) {
      return;
    }
    await submitOAuthCodeCallback(session.spec.sessionId, callbackDelivery, callbackInput);
  };

  return (
    <Card size="2" variant="classic">
      <OAuthSessionCard
        header={(
          <Flex justify="between" align="center">
            <Box>
              <Text weight="medium">{session.spec?.targetDisplayName || session.spec?.sessionId}</Text>
              <Text size="1" color="gray">{session.spec?.cliId ? `CLI · ${session.spec.cliId}` : "CLI OAuth"}</Text>
            </Box>
            <StatusBadge color={badgeColor} label={phaseLabel} />
          </Flex>
        )}
        statusColor={badgeColor}
        statusMessage={session.status?.message?.trim()
          ? `${phaseLabel} · ${session.status.message}`
          : phaseLabel}
        userCode={isDeviceFlow ? session.status?.userCode : undefined}
        onOpenAuthorization={session.status?.authorizationUrl ? () => {
          openExternalUrl(session.status?.authorizationUrl);
        } : undefined}
        openAuthorizationVariant="soft"
        openAuthorizationColor="gray"
        manualCallback={canSubmitCallback ? {
          canSubmit: canSubmitCallback,
          onSubmitCallback: submitManualCallback,
          onSubmitted: onCallbackSubmitted,
          disabled: isCancelling,
        } : undefined}
        footer={(
          <DialogFooterActions
            onSubmit={onBack}
            submitType="button"
            submitText="Back to Provider Credentials"
            onCancel={onCancel}
            cancelText="Cancel Session"
            showCancel={isActive}
            cancelDisabled={isCancelling}
            cancelLoading={isCancelling}
            cancelColor="red"
            cancelVariant="soft"
          />
        )}
      />
    </Card>
  );
}
