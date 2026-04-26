import { Dialog } from "@radix-ui/themes";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { providerObservabilityAuthPresentation } from "../provider-observability-auth-presentation";
import { ProviderObservabilityAuthenticationForm } from "./provider-observability-authentication-form";

type Props = {
  provider: ProviderView;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ProviderObservabilityAuthenticationView({
  provider,
  onSuccess,
  onCancel,
}: Props) {
  const presentation = providerObservabilityAuthPresentation(provider.vendorId);
  if (!presentation) {
    return null;
  }

  return (
    <>
      <Dialog.Title size="4" mb="3">{presentation.dialogTitle}</Dialog.Title>
      <ProviderObservabilityAuthenticationForm
        provider={provider}
        providerId={provider.providerId}
        vendorId={provider.vendorId}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </>
  );
}
