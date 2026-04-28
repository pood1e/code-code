import { Dialog } from "@radix-ui/themes";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import type { ProviderObservabilityAuthPresentation } from "../provider-observability-auth-presentation";
import { ProviderObservabilityAuthenticationForm } from "./provider-observability-authentication-form";

type Props = {
  provider: ProviderView;
  presentation: ProviderObservabilityAuthPresentation;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ProviderObservabilityAuthenticationView({
  provider,
  presentation,
  onSuccess,
  onCancel,
}: Props) {
  return (
    <>
      <Dialog.Title size="4" mb="3">{presentation.dialogTitle}</Dialog.Title>
      <ProviderObservabilityAuthenticationForm
        provider={provider}
        providerId={provider.providerId}
        presentation={presentation}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </>
  );
}
