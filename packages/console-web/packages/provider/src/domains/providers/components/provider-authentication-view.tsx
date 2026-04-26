import { Dialog } from "@radix-ui/themes";
import type { ComponentProps } from "react";
import type { ProviderView } from "@code-code/agent-contract/platform/management/v1";
import { ProviderAuthenticationForm } from "./provider-authentication-form";

type Props = {
  provider: ProviderView;
  authenticationKind: ComponentProps<typeof ProviderAuthenticationForm>["kind"];
  cliId?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ProviderAuthenticationView({
  provider,
  authenticationKind,
  cliId,
  onSuccess,
  onCancel,
}: Props) {
  return (
    <>
      <Dialog.Title size="4" mb="3">Update Auth</Dialog.Title>
      <ProviderAuthenticationForm
        providerId={provider.providerId}
        vendorId={provider.vendorId}
        cliId={cliId}
        kind={authenticationKind}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </>
  );
}
