export function normalizeDescription(description?: string) {
  return description?.trim() ? description.trim() : null;
}
