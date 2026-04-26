import type { OAuthCallbackDelivery } from "@code-code/agent-contract/platform/support/v1";
import { OAuthCallbackMode } from "@code-code/agent-contract/credential/v1";
import { ProviderConnectSessionPhase, type ProviderConnectSessionView } from "@code-code/agent-contract/platform/management/v1";
import { providerConnectPhaseColor, providerConnectPhaseLabel } from "./provider-connect-session-view";

export type ProviderConnectSessionStatusView = {
  color: ReturnType<typeof providerConnectPhaseColor> | "red";
  message: string;
};

export interface ProviderConnectSessionModel {
  readonly raw?: ProviderConnectSessionView;
  authorizationHint(): string | null;
  authorizationUrl(): string;
  canSubmitCallback(callbackDelivery?: Pick<OAuthCallbackDelivery, "mode" | "callbackProviderId" | "providerRedirectUri">): boolean;
  hideActions(): boolean;
  oauthSessionId(): string;
  status(errorMessage?: string): ProviderConnectSessionStatusView;
  userCode(): string;
}

class DefaultProviderConnectSessionModel implements ProviderConnectSessionModel {
  readonly raw?: ProviderConnectSessionView;

  constructor(session?: ProviderConnectSessionView) {
    this.raw = session;
  }

  authorizationHint() {
    return this.authorizationUrl()
      ? "Finish the browser authorization, then return here. The dialog will continue automatically when the provider is ready."
      : null;
  }

  authorizationUrl() {
    return this.raw?.authorizationUrl?.trim() || "";
  }

  canSubmitCallback(callbackDelivery?: Pick<OAuthCallbackDelivery, "mode" | "callbackProviderId" | "providerRedirectUri">) {
    return callbackDelivery?.mode === OAuthCallbackMode.LOCALHOST_RELAY
      && Boolean(this.oauthSessionId())
      && Boolean(this.authorizationUrl())
      && !this.hideActions();
  }

  hideActions() {
    return this.raw?.phase === ProviderConnectSessionPhase.PROCESSING;
  }

  oauthSessionId() {
    return this.raw?.oauthSessionId?.trim() || "";
  }

  status(errorMessage = ""): ProviderConnectSessionStatusView {
    const normalizedErrorMessage = errorMessage.trim();
    if (normalizedErrorMessage) {
      return {
        color: "red",
        message: normalizedErrorMessage,
      };
    }
    const phase = this.raw?.phase;
    const message = (this.raw?.errorMessage || this.raw?.message || "Waiting for provider connect session state.").trim();
    return {
      color: providerConnectPhaseColor(phase),
      message: `${providerConnectPhaseLabel(phase)}${message ? ` · ${message}` : ""}`,
    };
  }

  userCode() {
    return this.raw?.userCode?.trim() || "";
  }
}

export function providerConnectSessionModel(session?: ProviderConnectSessionView): ProviderConnectSessionModel {
  return new DefaultProviderConnectSessionModel(session);
}
