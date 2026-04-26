export function buildCredentialId(displayName: string) {
  return displayName.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
