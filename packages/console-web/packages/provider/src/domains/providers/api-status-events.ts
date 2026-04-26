import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { useEffect, useRef } from "react";
import useSWRSubscription from "swr/subscription";
import {
  ProviderStatusEventSchema,
  type ProviderStatusEvent,
} from "@code-code/agent-contract/platform/management/v1";
import { asError, protobufJsonReadOptions } from "@code-code/console-web-ui";

const providerStatusEventsPath = "/api/providers/events";
const providerStatusEventName = "provider-status";
const providerStatusEventRefreshDelayMs = 250;

export function useProviderStatusEvents(onEvent: (event: ProviderStatusEvent) => void) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const { error } = useSWRSubscription<JsonValue>(
    providerStatusEventsPath,
    (eventsPath: string, { next }: { next: (error?: Error | null, data?: JsonValue) => void }) => {
      if (typeof EventSource === "undefined") {
        return () => {};
      }
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let pendingEvent: ProviderStatusEvent | undefined;
      const eventSource = new EventSource(eventsPath);
      eventSource.addEventListener(providerStatusEventName, (event) => {
        if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
          return;
        }
        try {
          const payload = JSON.parse(event.data) as JsonValue;
          const statusEvent = fromJson(ProviderStatusEventSchema, payload, protobufJsonReadOptions);
          pendingEvent = statusEvent;
          next(null, payload);
          if (!refreshTimer) {
            refreshTimer = setTimeout(() => {
              refreshTimer = undefined;
              if (pendingEvent) {
                onEventRef.current(pendingEvent);
              }
              pendingEvent = undefined;
            }, providerStatusEventRefreshDelayMs);
          }
        } catch (error: unknown) {
          next(asError(error));
          eventSource.close();
        }
      });
      return () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }
        eventSource.close();
      };
    },
  );
  return { error };
}
