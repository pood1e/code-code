import { OAuthAuthorizationFlow, OAuthAuthorizationPhase, type OAuthAuthorizationSessionState } from "@code-code/agent-contract/credential/v1";

export function getOAuthPhaseLabel(phase: OAuthAuthorizationPhase) {
  switch (phase) {
    case OAuthAuthorizationPhase.AWAITING_USER:
      return "Awaiting User";
    case OAuthAuthorizationPhase.PROCESSING:
      return "Processing";
    case OAuthAuthorizationPhase.SUCCEEDED:
      return "Succeeded";
    case OAuthAuthorizationPhase.FAILED:
      return "Failed";
    case OAuthAuthorizationPhase.EXPIRED:
      return "Expired";
    case OAuthAuthorizationPhase.CANCELED:
      return "Canceled";
    case OAuthAuthorizationPhase.PENDING:
      return "Pending";
    default:
      return "Unspecified";
  }
}

export function isDeviceFlowSession(session?: OAuthAuthorizationSessionState) {
  return session?.spec?.flow === OAuthAuthorizationFlow.DEVICE;
}
