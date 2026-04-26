import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { requestErrorMessage } from "@code-code/console-web-ui";
import {
  ProviderStatusEventKind,
  type ProviderStatusEvent,
  type ProviderView,
} from "@code-code/agent-contract/platform/management/v1";
import { useProviderCLIs, useProviderSurfaces, useProviderVendors } from "@code-code/console-web-credential";
import {
  mutateProviderObservability,
  probeAllProviderObservability,
  probeProvidersObservability,
  useProviderStatusEvents,
} from "../domains/providers/api";
import { formatProviderObservabilityProbeSummary } from "../domains/providers/provider-observability-probe-summary";
import { providerModel } from "../domains/providers/provider-model";
import { providerActiveQueryProviderIDs } from "../domains/providers/provider-observability-visualization";
import { type ProviderConnectOptionKind } from "../domains/providers/provider-connect-options";
import { useProviders } from "../domains/providers/reference-data";
import {
  providerWorkflowStatusFromEvent,
  type ProviderWorkflowStatusView,
} from "../domains/providers/provider-workflow-status-view";
import {
  buildProviderPageSearchParams,
  readProviderPageSearchState,
  resolveFocusedProvider,
} from "./provider-page-search";

const providerNameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function useProvidersPageController() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { providers, error: providersError, isLoading, isError, mutate, upsertProvider } = useProviders();
  const { clis } = useProviderCLIs();
  const { surfaces } = useProviderSurfaces();
  const { vendors } = useProviderVendors();
  const searchState = readProviderPageSearchState(searchParams);
  const searchFocusKey = providerSearchFocusKey(searchState);
  const [selectedProvider, setSelectedProvider] = useState<ProviderView | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [preferredAddKind, setPreferredAddKind] = useState<ProviderConnectOptionKind | undefined>(searchState.connectKind);
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);
  const [probingProviderId, setProbingProviderId] = useState("");
  const [observabilityProbeMessage, setObservabilityProbeMessage] = useState("");
  const [observabilityProbeError, setObservabilityProbeError] = useState("");
  const [providerWorkflowStatuses, setProviderWorkflowStatuses] = useState<Record<string, ProviderWorkflowStatusView>>({});
  const dismissedSearchFocusKeyRef = useRef("");
  const dismissedConnectSessionIDRef = useRef("");

  const sortedProviders = useMemo(
    () => [...providers].sort((left, right) => (
      providerNameCollator.compare(providerModel(left).displayName(), providerModel(right).displayName())
    )),
    [providers],
  );
  const blockingError = isError && sortedProviders.length === 0 ? providersError : undefined;
  const handleProviderStatusEvent = useCallback((event: ProviderStatusEvent) => {
    if (event.kind === ProviderStatusEventKind.WORKFLOW && event.providerId.trim()) {
      setProviderWorkflowStatuses((current) => providerWorkflowStatusesWithEvent(current, event));
    }
    void mutate();
  }, [mutate]);
  const { error: providerStatusEventsError } = useProviderStatusEvents(handleProviderStatusEvent);

  useEffect(() => {
    setPreferredAddKind(searchState.connectKind);
  }, [searchState.connectKind]);

  useEffect(() => {
    const sessionID = searchState.connectSessionId;
    if (!sessionID) {
      dismissedConnectSessionIDRef.current = "";
      return;
    }
    if (dismissedConnectSessionIDRef.current !== sessionID) {
      setIsAddDialogOpen(true);
    }
  }, [searchState.connectSessionId]);

  useEffect(() => {
    if (!searchFocusKey) {
      dismissedSearchFocusKeyRef.current = "";
      return;
    }
    if (dismissedSearchFocusKeyRef.current === searchFocusKey || selectedProvider) {
      return;
    }
    const provider = resolveFocusedProvider(sortedProviders, searchState);
    if (provider) {
      setSelectedProvider(provider);
    }
  }, [searchState, searchFocusKey, selectedProvider, sortedProviders]);

  const updateProviderPageSearch = (patch: Parameters<typeof buildProviderPageSearchParams>[1]) => {
    setSearchParams(buildProviderPageSearchParams(searchParams, patch), { replace: true });
  };
  const updateConnectSessionParam = (sessionId?: string, optionKind?: ProviderConnectOptionKind) => {
    updateProviderPageSearch({ connectSessionId: sessionId, connectKind: optionKind });
  };

  const openProvider = (provider: ProviderView) => {
    dismissedSearchFocusKeyRef.current = "";
    setSelectedProvider(provider);
    updateProviderPageSearch({ providerId: provider.providerId, credentialId: undefined });
  };
  const closeProvider = () => {
    if (searchFocusKey) {
      dismissedSearchFocusKeyRef.current = searchFocusKey;
    }
    setSelectedProvider(null);
    updateProviderPageSearch({ providerId: undefined, credentialId: undefined });
  };
  const refreshProviderPageData = async () => {
    await mutate();
  };

  const handleConnected = async (provider: ProviderView) => {
    dismissedConnectSessionIDRef.current = "";
    updateConnectSessionParam(undefined, undefined);
    setIsAddDialogOpen(false);
    if (provider.providerId.trim()) {
      await upsertProvider(provider);
      return;
    }
    await refreshProviderPageData();
  };

  const handleAdd = (kind?: ProviderConnectOptionKind) => {
    dismissedConnectSessionIDRef.current = "";
    setPreferredAddKind(kind);
    setIsAddDialogOpen(true);
  };

  const handleRefreshQuota = async () => {
    if (isRefreshingQuota) {
      return;
    }
    setIsRefreshingQuota(true);
    setObservabilityProbeError("");
    setObservabilityProbeMessage("");
    try {
      setObservabilityProbeMessage(formatProviderObservabilityProbeSummary(await probeAllProviderObservability()));
      await mutateProviderObservability();
    } catch (error) {
      setObservabilityProbeError(requestErrorMessage(error, "Failed to refresh quota"));
    } finally {
      setIsRefreshingQuota(false);
    }
  };

  const handleProbeProviderActiveQuery = async (provider: ProviderView) => {
    if (isRefreshingQuota || probingProviderId) {
      return;
    }
    const providerId = provider.providerId.trim();
    if (!providerId) {
      return;
    }
    const providerIds = providerActiveQueryProviderIDs(provider, clis, vendors);
    if (providerIds.length === 0) {
      setObservabilityProbeError("This provider does not expose active query observability.");
      setObservabilityProbeMessage("");
      return;
    }
    setProbingProviderId(providerId);
    setObservabilityProbeError("");
    setObservabilityProbeMessage("");
    try {
      setObservabilityProbeMessage(formatProviderObservabilityProbeSummary(
        await probeProvidersObservability(providerIds),
      ));
      await mutateProviderObservability(providerId);
      await mutateProviderObservability();
    } catch (error) {
      setObservabilityProbeError(requestErrorMessage(error, "Failed to run provider active query."));
    } finally {
      setProbingProviderId("");
    }
  };

  return {
    searchState,
    sortedProviders,
    isLoading,
    blockingError,
    clis,
    surfaces,
    vendors,
    isAddDialogOpen,
    preferredAddKind,
    selectedProvider,
    isRefreshingQuota,
    probingProviderId,
    observabilityProbeMessage,
    observabilityProbeError,
    providerStatusEventsError,
    providerWorkflowStatuses,
    mutateProviders: mutate,
    setIsAddDialogOpen,
    updateConnectSessionParam,
    refreshProviderPageData,
    handleConnected,
    handleAdd,
    handleRefreshQuota,
    handleProbeProviderActiveQuery,
    openProvider,
    closeProvider,
    dismissedConnectSessionIDRef,
  };
}

function providerSearchFocusKey(searchState: ReturnType<typeof readProviderPageSearchState>) {
  if (searchState.providerId) {
    return `provider:${searchState.providerId}`;
  }
  if (searchState.credentialId) {
    return `credential:${searchState.credentialId}`;
  }
  return "";
}

function providerWorkflowStatusesWithEvent(
  current: Record<string, ProviderWorkflowStatusView>,
  event: ProviderStatusEvent,
) {
  const providerId = event.providerId.trim();
  const status = providerWorkflowStatusFromEvent(event);
  const next = { ...current };
  if (status) {
    next[providerId] = status;
  } else {
    delete next[providerId];
  }
  return next;
}
