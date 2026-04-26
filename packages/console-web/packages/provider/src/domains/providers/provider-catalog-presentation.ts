import { CatalogSource } from "@code-code/agent-contract/provider/v1";

export function providerCatalogSourceLabelValue(source: CatalogSource | undefined) {
  switch (source) {
    case CatalogSource.PROTOCOL_QUERY:
      return "Discovered";
    case CatalogSource.FALLBACK_CONFIG:
      return "Configured Models";
    case CatalogSource.VENDOR_PRESET:
      return "Vendor Catalog";
    default:
      return "Unknown";
  }
}

export function providerCatalogSourceHelpValue(source: CatalogSource | undefined) {
  if (source === CatalogSource.VENDOR_PRESET) {
    return "This provider uses vendor-preset model IDs.";
  }
  if (source === CatalogSource.PROTOCOL_QUERY) {
    return "This provider uses model IDs discovered through the selected protocol.";
  }
  return "This provider uses configured model IDs.";
}
