export type ProviderAuthenticationKind = "apiKey" | "cliOAuth";

export type ProviderAuthenticationNotice = {
  color: "red" | "gray";
  message: string;
};

export interface ProviderAuthenticationModel {
  apiKeyPlaceholder(): string;
  missingAccountNotice(): ProviderAuthenticationNotice | null;
  oauthStartNotice(): ProviderAuthenticationNotice | null;
  reauthorizeLabel(): string;
  submitLabel(): string;
}

type ProviderAuthenticationModelInput = {
  providerId: string;
  vendorId?: string;
  kind: ProviderAuthenticationKind;
};

class DefaultProviderAuthenticationModel implements ProviderAuthenticationModel {
  private readonly providerId: string;
  private readonly vendorId: string;
  private readonly kind: ProviderAuthenticationKind;

  constructor(input: ProviderAuthenticationModelInput) {
    this.providerId = input.providerId;
    this.vendorId = input.vendorId?.trim() || "";
    this.kind = input.kind;
  }

  apiKeyPlaceholder() {
    return this.vendorId ? `${this.vendorId} API key` : "sk-…";
  }

  missingAccountNotice(): ProviderAuthenticationNotice | null {
    if (this.providerId.trim()) {
      return null;
    }
    return {
      color: "red",
      message: "This provider is missing its stable provider identifier.",
    };
  }

  oauthStartNotice(): ProviderAuthenticationNotice | null {
    if (this.kind !== "cliOAuth") {
      return null;
    }
    return {
      color: "gray",
      message: "Start a new CLI OAuth authorization to refresh the shared provider authentication.",
    };
  }

  reauthorizeLabel() {
    return "Reauthorize";
  }

  submitLabel() {
    return "Update Authentication";
  }
}

export function providerAuthenticationModel(input: ProviderAuthenticationModelInput): ProviderAuthenticationModel {
  return new DefaultProviderAuthenticationModel(input);
}
