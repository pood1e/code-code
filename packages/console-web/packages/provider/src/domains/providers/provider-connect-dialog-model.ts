import {
  findProviderConnectOption,
  listProviderConnectOptions,
  type ProviderConnectOptionKind,
} from "./provider-connect-options";

export type ProviderConnectDialogCopy = {
  selectLabel: string;
  title: string;
};

export type ProviderConnectDialogOption = ReturnType<typeof listProviderConnectOptions>[number];

export interface ProviderConnectDialogModel {
  copy(): ProviderConnectDialogCopy;
  option(connectOptionId: string): ProviderConnectDialogOption | undefined;
  preferredOption(): ProviderConnectDialogOption | undefined;
  scopedOptions(): ProviderConnectDialogOption[];
  selectedOption(connectOptionId: string): ProviderConnectDialogOption | undefined;
}

class DefaultProviderConnectDialogModel implements ProviderConnectDialogModel {
  private readonly connectOptions: ReturnType<typeof listProviderConnectOptions>;
  private readonly preferredOptionKind?: ProviderConnectOptionKind;

  constructor(
    connectOptions: ReturnType<typeof listProviderConnectOptions>,
    preferredOptionKind?: ProviderConnectOptionKind,
  ) {
    this.connectOptions = connectOptions;
    this.preferredOptionKind = preferredOptionKind;
  }

  copy() {
    switch (this.preferredOptionKind) {
      case "vendorApiKey":
        return {
          title: "Add Provider with Vendor API Key",
          selectLabel: "Vendor",
        };
      case "customApiKey":
        return {
          title: "Add Custom API Key Provider",
          selectLabel: "",
        };
      case "cliOAuth":
        return {
          title: "Add Provider with CLI OAuth",
          selectLabel: "CLI",
        };
      default:
        return {
          title: "Add Provider",
          selectLabel: "Add Method",
        };
    }
  }

  option(connectOptionId: string) {
    return findProviderConnectOption(this.scopedOptions(), connectOptionId);
  }

  preferredOption() {
    if (!this.preferredOptionKind) {
      return this.connectOptions[0];
    }
    return this.connectOptions.find((option) => option.kind === this.preferredOptionKind) ?? this.connectOptions[0];
  }

  scopedOptions() {
    if (!this.preferredOptionKind) {
      return this.connectOptions;
    }
    return this.connectOptions.filter((option) => option.kind === this.preferredOptionKind);
  }

  selectedOption(connectOptionId: string) {
    return this.option(connectOptionId) ?? this.preferredOption();
  }
}

export function providerConnectDialogModel(
  connectOptions: ReturnType<typeof listProviderConnectOptions>,
  preferredOptionKind?: ProviderConnectOptionKind,
): ProviderConnectDialogModel {
  return new DefaultProviderConnectDialogModel(connectOptions, preferredOptionKind);
}

export function resolveProviderConnectOptionsError(
  vendorError: unknown,
  cliError: unknown,
  hasError: boolean,
) {
  if (!hasError) {
    return undefined;
  }
  if (vendorError instanceof Error) {
    return vendorError;
  }
  if (cliError instanceof Error) {
    return cliError;
  }
  return new Error("Failed to load provider connect options.");
}
