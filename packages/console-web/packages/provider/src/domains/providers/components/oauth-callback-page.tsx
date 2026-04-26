import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { useEffect, useMemo, useState } from "react";
import { GetProviderConnectSessionResponseSchema } from "@code-code/agent-contract/platform/management/v1";
import { ErrorCallout, protobufJsonReadOptions, requestErrorMessage } from "@code-code/console-web-ui";
import { Flex, Spinner, Text } from "@radix-ui/themes";
import { useNavigate, useSearchParams } from "react-router-dom";

type ProbeState =
  | { kind: "probing" }
  | { kind: "provider-connect" }
  | { kind: "generic" }
  | { kind: "error"; message: string };

type ProbeResult =
  | { sessionId: string; kind: "provider-connect" | "generic" }
  | { sessionId: string; kind: "error"; message: string };

export function OAuthCallbackPageRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    void probeProviderConnectSession(sessionId)
      .then((isProviderConnectSession) => {
        if (cancelled) {
          return;
        }
        setProbeResult({
          sessionId,
          kind: isProviderConnectSession ? "provider-connect" : "generic",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setProbeResult({
          sessionId,
          kind: "error",
          message: requestErrorMessage(error, "Failed to resume provider connect session."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const state = useMemo<ProbeState>(() => {
    if (!sessionId) {
      return { kind: "generic" };
    }
    if (!probeResult || probeResult.sessionId !== sessionId) {
      return { kind: "probing" };
    }
    if (probeResult.kind === "error") {
      return { kind: "error", message: probeResult.message };
    }
    return { kind: probeResult.kind };
  }, [probeResult, sessionId]);

  useEffect(() => {
    if (state.kind !== "provider-connect" || !sessionId) {
      return;
    }
    navigate(`/providers?connectSession=${encodeURIComponent(sessionId)}`, { replace: true });
  }, [navigate, sessionId, state]);

  if (state.kind === "generic") {
    return <ErrorCallout>Provider OAuth session is missing.</ErrorCallout>;
  }

  if (state.kind === "error") {
    return <ErrorCallout>{state.message}</ErrorCallout>;
  }

  return (
    <Flex direction="column" align="center" justify="center" gap="3" style={{ minHeight: 240 }}>
      <Spinner size="3" />
      <Text size="2" color="gray">
        {state.kind === "provider-connect"
          ? "Returning to Providers…"
          : "Resuming provider connect session…"}
      </Text>
    </Flex>
  );
}

async function probeProviderConnectSession(sessionId: string) {
  const response = await fetch(buildRequestUrl(`/api/providers/connect/sessions/${encodeURIComponent(sessionId)}`), {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(await response.text() || `HTTP Error ${response.status}`);
  }
  const payload = await response.json() as JsonValue;
  const parsed = fromJson(GetProviderConnectSessionResponseSchema, payload, protobufJsonReadOptions);
  return Boolean(parsed.session);
}

function buildRequestUrl(path: string) {
  const apiBaseUrl = (import.meta.env.VITE_CONSOLE_API_BASE_URL?.trim() || "").replace(/\/$/, "");
  return `${apiBaseUrl}${path}`;
}
