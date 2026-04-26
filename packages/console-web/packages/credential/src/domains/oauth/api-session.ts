import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { OAuthAuthorizationSessionStateSchema, OAuthAuthorizationPhase } from "@code-code/agent-contract/credential/v1";
import { asError, jsonFetcher, protobufJsonReadOptions } from "@code-code/console-web-ui";
import useSWR from "swr";
import useSWRSubscription from "swr/subscription";
import { buildOAuthSessionEventsPath, isTerminalOAuthPhase } from "./api-helpers";

const oauthSessionsPath = "/api/oauth/sessions";
const sessionEventName = "session";

export function useOAuthSession(sessionId?: string) {
  const key = sessionId ? `${oauthSessionsPath}/${encodeURIComponent(sessionId)}` : null;
  const eventsKey = sessionId ? buildOAuthSessionEventsPath(sessionId) : null;
  const { data, error, isLoading, mutate } = useSWR<JsonValue>(
    key,
    jsonFetcher<JsonValue>,
  );
  const { data: streamData } = useSWRSubscription<JsonValue>(
    eventsKey,
    (eventsPath: string, { next }: { next: (error?: Error | null, data?: JsonValue) => void }) => {
      const eventSource = new EventSource(eventsPath);
      eventSource.addEventListener(sessionEventName, (event) => {
        if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as JsonValue;
          next(null, payload);
          const session = fromJson(OAuthAuthorizationSessionStateSchema, payload, protobufJsonReadOptions);
          if (isTerminalOAuthPhase(session.status?.phase || OAuthAuthorizationPhase.UNSPECIFIED)) {
            eventSource.close();
          }
        } catch (error: unknown) {
          next(asError(error));
          eventSource.close();
        }
      });
      return () => eventSource.close();
    }
  );
  const sessionData = streamData || data;
  const session = sessionData
    ? fromJson(OAuthAuthorizationSessionStateSchema, sessionData, protobufJsonReadOptions)
    : undefined;
  return { session, error, isLoading: !sessionData && !error && isLoading, isError: !!error, mutate };
}
