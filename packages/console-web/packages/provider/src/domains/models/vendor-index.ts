import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";

export function buildVendorIndex(vendors: VendorView[]) {
  const index: Record<string, VendorView> = {};
  for (const vendor of vendors) {
    for (const key of vendorKeys(vendor)) {
      index[key] = vendor;
    }
  }
  return index;
}

export function vendorLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function vendorKeys(vendor: VendorView) {
  const keys = new Set<string>();
  const vendorId = vendorLookupKey(vendor.vendorId);
  if (vendorId) {
    keys.add(vendorId);
  }
  for (const alias of vendor.aliases) {
    const key = vendorLookupKey(alias);
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}
