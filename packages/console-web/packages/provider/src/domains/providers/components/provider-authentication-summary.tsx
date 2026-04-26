import type { ReactNode } from "react";
import { ErrorCallout, SurfacePanel } from "@code-code/console-web-ui";
import { DetailList, DetailListItem } from "../../../components/detail-list";
import { type ProviderAuthenticationKind } from "../provider-authentication-view";

type Props = {
  providerCredentialId: string;
  kind: ProviderAuthenticationKind;
};

export function ProviderAuthenticationSummary({ providerCredentialId, kind }: Props) {
  if (!providerCredentialId.trim()) {
    return (
      <ErrorCallout mt="2">Missing authentication record.</ErrorCallout>
    );
  }

  return (
    <AuthenticationDetailsCard
      providerCredentialId={providerCredentialId}
      kind={kind}
    />
  );
}

function AuthenticationDetailsCard({
  providerCredentialId,
  kind,
}: {
  providerCredentialId: string;
  kind: ProviderAuthenticationKind;
}) {
  return (
    <SurfacePanel cardProps={{ mt: "2" }}>
      <DetailList size="1">
        <AuthenticationItem label="Credential" value={providerCredentialId} />
        {kind === "cliOAuth" ? (
          <AuthenticationItem label="Type" value="CLI OAuth" />
        ) : (
          <AuthenticationItem label="Type" value="API key" />
        )}
        <AuthenticationItem label="Secret" value="Managed by auth service" />
      </DetailList>
    </SurfacePanel>
  );
}

function AuthenticationItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <DetailListItem
      label={label}
      labelColor="gray"
      labelSize="1"
      valueSize="1"
    >
      {value}
    </DetailListItem>
  );
}
