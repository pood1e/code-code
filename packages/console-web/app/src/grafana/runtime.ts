import useSWR from "swr";

const defaultGrafanaBaseUrl = "/grafana";

type GrafanaHealthResponse = {
  commit?: unknown;
  database?: unknown;
  version?: unknown;
};

function normalizeGrafanaBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/\/+$/, "");
  return normalized.startsWith("/") || /^https?:\/\//.test(normalized)
    ? normalized
    : `/${normalized}`;
}

export function readGrafanaBaseUrl(env: ImportMetaEnv) {
  const configured = env.VITE_GRAFANA_BASE_URL;
  if (configured !== undefined) {
    return normalizeGrafanaBaseUrl(configured);
  }
  return defaultGrafanaBaseUrl;
}

export function resolveGrafanaAppUrl(baseUrl: string) {
  return baseUrl;
}

function resolveGrafanaProbeUrl(baseUrl: string) {
  return baseUrl ? `${baseUrl}/api/health` : "";
}

function isGrafanaHealthResponse(value: unknown): value is GrafanaHealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const health = value as GrafanaHealthResponse;
  return typeof health.database === "string" || typeof health.version === "string";
}

export async function probeGrafanaAvailability(probeUrl: string) {
  try {
    const response = await fetch(probeUrl, {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401 || response.status === 403) {
      return true;
    }
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return false;
    }

    return isGrafanaHealthResponse(await response.json());
  } catch {
    return false;
  }
}

export function useGrafanaAvailability() {
  const baseUrl = readGrafanaBaseUrl(import.meta.env);
  const probeUrl = resolveGrafanaProbeUrl(baseUrl);
  const { data, isLoading } = useSWR(
    probeUrl || null,
    probeGrafanaAvailability,
    {
      dedupingInterval: 0,
      revalidateOnMount: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false
    }
  );

  return {
    appUrl: resolveGrafanaAppUrl(baseUrl),
    available: data === true,
    checking: Boolean(probeUrl) && isLoading && data === undefined
  };
}
