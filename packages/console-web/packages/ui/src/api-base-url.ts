export const apiBaseUrl = (import.meta.env.VITE_CONSOLE_API_BASE_URL?.trim() || "").replace(/\/$/, "");

export function getApiRequestUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}
