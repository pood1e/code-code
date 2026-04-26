import { useMemo, useState } from "react";
import { OAuthAuthorizationPhase } from "@code-code/agent-contract/credential/v1";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
import { startTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AsyncState, NoDataCallout, StatusCallout } from "@code-code/console-web-ui";
import { useProviderCLIs } from "../../credentials/reference-data";
import {
  cancelOAuthSession,
  isTerminalOAuthPhase,
  useOAuthSession
} from "../api";
import { OAuthSessionStatusCard } from "./oauth-session-status-card";

export function OAuthSessionCallbackView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCancelling, setIsCancelling] = useState(false);
  const sessionId = searchParams.get("sessionId")?.trim();
  const { session, error, isLoading, mutate } = useOAuthSession(sessionId);
  const { clis } = useProviderCLIs();
  const callbackDelivery = useMemo(() => {
    const cliId = session?.spec?.cliId?.trim() || "";
    if (!cliId) {
      return undefined;
    }
    return clis.find((item) => item.cliId === cliId)?.oauth?.codeFlow?.callbackDelivery;
  }, [clis, session?.spec?.cliId]);

  const handleBack = () => startTransition(() => navigate("/provider-credentials"));
  const handleCancel = async () => {
    if (!sessionId) return;
    setIsCancelling(true);
    try {
      await cancelOAuthSession(sessionId);
      await mutate();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Box>
      <Flex direction="column" gap="4">
        <Box>
          <Heading size="5">OAuth Session</Heading>
          <Text size="2" color="gray">Track one authorization session until the credential import finishes.</Text>
        </Box>
        {!sessionId ? (
          <NoDataCallout>Missing sessionId query parameter.</NoDataCallout>
        ) : null}
        <AsyncState
          loading={Boolean(sessionId) && isLoading}
          error={sessionId ? error : undefined}
          errorTitle="Failed to read OAuth session."
          onRetry={() => void mutate()}
        >
          {session ? (
            <Flex direction="column" gap="3">
              {isTerminalOAuthPhase(
                session.status?.phase || OAuthAuthorizationPhase.UNSPECIFIED
              ) ? (
                <StatusCallout
                  color={session.status?.phase === OAuthAuthorizationPhase.SUCCEEDED ? "green" : "red"}
                >
                  {session.status?.phase === OAuthAuthorizationPhase.SUCCEEDED
                    ? "OAuth credential imported successfully."
                    : "OAuth session finished with an error."}
                </StatusCallout>
              ) : null}
              <OAuthSessionStatusCard
                session={session}
                onBack={handleBack}
                onCancel={handleCancel}
                isCancelling={isCancelling}
                callbackDelivery={callbackDelivery}
                onCallbackSubmitted={async () => {
                  await mutate();
                }}
              />
            </Flex>
          ) : null}
        </AsyncState>
      </Flex>
    </Box>
  );
}
