import { Code, Flex, Text } from "@radix-ui/themes";
import type { CredentialView } from "../api";
import { StatusBadge } from "@code-code/console-web-ui";
import { formatCredentialOwnerLabel } from "./credential-formatters";

type CredentialKind = "api-key" | "oauth" | "cookie";

export function CredentialName({ credential }: { credential: CredentialView }) {
  return <Text weight="medium">{credential.displayName}</Text>;
}

export function CredentialVendor({ credential }: { credential: CredentialView }) {
  const owner = credential.kind === "CREDENTIAL_KIND_OAUTH"
    ? credential.cliId
    : credential.vendorId;
  return <Code size="1" variant="ghost" color="gray">{formatCredentialOwnerLabel(owner)}</Code>;
}

export function CredentialDetail({ credential, kind }: { credential: CredentialView; kind: CredentialKind }) {
  if (kind === "oauth") {
    return (
      <Flex direction="column" gap="1">
        {credential.accountEmail ? <Text size="2">{credential.accountEmail}</Text> : <Text size="2" color="gray">No account</Text>}
        <CredentialMaterialStatus credential={credential} />
      </Flex>
    );
  }
  if (kind === "api-key") {
    return <CredentialMaterialStatus credential={credential} />;
  }
  return <Text size="2">{formatCredentialOwnerLabel(credential.cliId || credential.vendorId)}</Text>;
}

function CredentialMaterialStatus({ credential }: { credential: CredentialView }) {
  if (credential.status?.materialReady) {
    return <StatusBadge color="green" label="Ready" />;
  }
  return (
    <Flex direction="column" gap="1" align="start">
      <StatusBadge color="amber" label="Not ready" />
      {credential.status?.reason ? <Text size="1" color="gray">{credential.status.reason}</Text> : null}
    </Flex>
  );
}
