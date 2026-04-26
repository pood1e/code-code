import type { EgressConfigSourceKind } from "./network-types";

export function sourceColor(kind: EgressConfigSourceKind) {
  if (kind === "cli") {
    return "blue";
  }
  if (kind === "service") {
    return "amber";
  }
  return "green";
}
