import { SoftBadge } from "@code-code/console-web-ui";

export function getPurposeLabel(purpose?: string) {
  if (!purpose || purpose === "CREDENTIAL_PURPOSE_UNSPECIFIED") {
    return "Unspecified";
  }

  return purpose.replace("CREDENTIAL_PURPOSE_", "").replace(/_/g, " ");
}

export function CredentialKindBadge({ kind }: { kind: string }) {
  if (kind === "CREDENTIAL_KIND_API_KEY") {
    return <SoftBadge color="indigo" label="API Key" />;
  }
  if (kind === "CREDENTIAL_KIND_OAUTH") {
    return <SoftBadge color="amber" label="OAuth App" />;
  }
  return <SoftBadge color="gray" label={kind} />;
}

export function formatCredentialOwnerLabel(value?: string) {
  if (!value) {
    return "Unspecified";
  }
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
