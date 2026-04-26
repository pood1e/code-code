import type { CLI, Vendor } from "@code-code/agent-contract/platform/support/v1";
import { normalizeProviderOwnerId } from "./provider-owner-id";

export function findCLI(
  clis: CLI[],
  cliId: string,
) {
  const normalizedCLIID = normalizeProviderOwnerId(cliId);
  if (!normalizedCLIID) {
    return undefined;
  }
  return clis.find((item) => normalizeProviderOwnerId(item.cliId || "") === normalizedCLIID);
}

export function findVendor(
  vendors: Vendor[],
  vendorId: string,
) {
  const normalizedVendorID = normalizeProviderOwnerId(vendorId);
  if (!normalizedVendorID) {
    return undefined;
  }
  return vendors.find(
    (item) => normalizeProviderOwnerId(item.vendor?.vendorId || "") === normalizedVendorID
  );
}
