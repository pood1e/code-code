import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import { create } from "@bufbuild/protobuf";
import { firstErrorMessage, requestErrorMessage } from "@code-code/console-web-ui";
import { AgentResourcesSchema } from "@code-code/agent-contract/agent/v1/cap";
import { AgentSessionRuntimeConfigSchema } from "@code-code/agent-contract/platform/agent-session/v1";
import { createChat, getChatOrNull, listAgentProfiles, listSessionRuntimeOptions, listChatMessages, listChats, putChat } from "./api";
import { createChatSessionPanelActions } from "./chat-session-panel-actions";
import { createChatSessionPanelState } from "./chat-session-panel-state";
import { buildChatSetupRequest, isChatSetupReady, readCanSendChatRun } from "./chat-session-model";
import { importInlineSetupFromProfile } from "./profile-import";
import { parseProjectionState, type ChatProjectionState } from "./projection";
import { runtimePrimaryModelId } from "./runtime-model-selector";
import { runtimeRefKey } from "./session-runtime-options";
import { EMPTY_SESSION_RUNTIME_OPTIONS, normalizeInlineDraftWithSessionRuntimeOptions } from "./session-runtime-options";
import { readDefaultProfileSelection, readLoadedChatSessionState } from "./chat-session-view-sync";
import { cloneInlineSetup, hasPendingSetupChange, sameInlineSetup, type ChatInlineSetup, type ChatListItem, type ChatMessage, type ChatMode, type ChatSetupRequest, type ChatView } from "./types";

type ChatSessionStageController = {
  busy: boolean;
  chatId: string;
  sessionId: string;
  setupDirty: boolean;
  canSend: boolean;
  projection: ChatProjectionState | null;
  messages: ChatMessage[];
  onBeforeRun: () => Promise<void>;
  onError: (message: string) => void;
  onStateChange: (state: unknown) => void;
};

export type ChatListController = {
  items: ChatListItem[];
  activeChatId: string;
  loading: boolean;
  onSelect: (chatId: string) => void;
  onNew: () => void;
};

export type ChatSessionCardController = {
  chatList: ChatListController;
  panelState: ReturnType<typeof createChatSessionPanelState>;
  panelActions: ReturnType<typeof createChatSessionPanelActions>;
  stage: ChatSessionStageController;
  errorMessage?: string;
  statusMessage: string;
};

type SessionCreateFlight = {
  key: string;
  promise: Promise<ChatView>;
};

export function useChatSessionCardController(): ChatSessionCardController {
  const params = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const newChatRequested = params.chatId === "new";
  const routeChatID = newChatRequested ? "" : params.chatId?.trim() || "";
  const [chatId, setChatId] = useState(routeChatID);
  const [mode, setMode] = useState<ChatMode>("inline");
  const [profileId, setProfileId] = useState("");
  const [inlineImportProfileId, setInlineImportProfileId] = useState("");
  const [inlineDraft, setInlineDraft] = useState<ChatInlineSetup | null>(() => createInlineDraftFromScratch());
  const [inlineRuntimeOpen, setInlineRuntimeOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [projection, setProjection] = useState<ChatProjectionState | null>(null);

  const normalizedChatID = chatId.trim();
  const activeChatIDRef = useRef("");
  const sessionCreateFlight = useRef<SessionCreateFlight | null>(null);
  const bootstrapInFlightKey = useRef("");
  const latestSetupKey = useRef("");
  const lastSyncedChatIDRef = useRef("");

  useEffect(() => {
    activeChatIDRef.current = normalizedChatID;
  }, [normalizedChatID]);

  useEffect(() => {
    setChatId(routeChatID);
    activeChatIDRef.current = routeChatID;
    if (!routeChatID) {
      lastSyncedChatIDRef.current = "";
      setProjection(null);
    }
  }, [routeChatID]);

  const deferredChatID = useDeferredValue(normalizedChatID);
  const chatListQuery = useSWR(["chat-list"], () => listChats());
  const profilesQuery = useSWR(["chat-profiles"], () => listAgentProfiles());
  const runtimeOptionsQuery = useSWR(["session-runtime-options"], () => listSessionRuntimeOptions());
  const chatQuery = useSWR(
    deferredChatID ? ["chat-view", deferredChatID] : null,
    ([, value]: [string, string]) => getChatOrNull(value),
  );
  const messagesQuery = useSWR(
    deferredChatID ? ["chat-messages", deferredChatID] : null,
    ([, value]: [string, string]) => listChatMessages(value),
  );

  const loadedChatView = normalizedChatID && deferredChatID === normalizedChatID ? chatQuery.data : undefined;
  const loadedSessionID = loadedChatView?.session.id.trim() || "";
  const panelBusy = isBusy || isSavingSetup;
  const modeLocked = Boolean(normalizedChatID);
  const bootstrapReady = isChatSetupReady(mode, profileId, inlineDraft);
  const recentChatID = chatListQuery.data?.items[0]?.id.trim() || "";

  useEffect(() => {
    if (newChatRequested || routeChatID || chatListQuery.isLoading || !recentChatID) {
      return;
    }
    navigate(chatRoute(recentChatID), { replace: true });
  }, [chatListQuery.isLoading, navigate, newChatRequested, recentChatID, routeChatID]);

  const setupKey = useMemo(() => {
    if (!bootstrapReady) {
      return "";
    }
    if (mode === "profile") {
      return `profile:${profileId.trim()}`;
    }
    return `inline:${inlineDraft?.providerId.trim()}:${inlineDraft?.executionClass.trim()}:${runtimeRefKey(inlineDraft?.runtimeConfig.providerRuntimeRef)}:${runtimePrimaryModelId(inlineDraft?.runtimeConfig.primaryModelSelector).trim()}`;
  }, [bootstrapReady, inlineDraft?.executionClass, inlineDraft?.providerId, inlineDraft?.runtimeConfig.primaryModelSelector, inlineDraft?.runtimeConfig.providerRuntimeRef, mode, profileId]);

  useEffect(() => {
    latestSetupKey.current = setupKey;
  }, [setupKey]);

  const canAutoCreate = bootstrapReady
    && !normalizedChatID
    && !panelBusy
    && !chatListQuery.isLoading
    && (newChatRequested || !recentChatID)
    && !profilesQuery.isLoading
    && !runtimeOptionsQuery.isLoading;

  useEffect(() => {
    if (!canAutoCreate || !setupKey) {
      return;
    }
    if (bootstrapInFlightKey.current === setupKey) {
      return;
    }
    bootstrapInFlightKey.current = setupKey;
    void withBusy(async () => {
      const request = buildChatSetupRequest(mode, profileId, inlineDraft);
      try {
        await ensureChatSession(request, setupKey);
      } finally {
        if (bootstrapInFlightKey.current === setupKey) {
          bootstrapInFlightKey.current = "";
        }
      }
    });
  }, [canAutoCreate, mode, profileId, inlineDraft, setupKey]);

  useEffect(() => {
    const defaults = readDefaultProfileSelection(profilesQuery.data || [], profileId, inlineImportProfileId);
    if (defaults.profileId) {
      setProfileId(defaults.profileId);
    }
    if (defaults.inlineImportProfileId) {
      setInlineImportProfileId(defaults.inlineImportProfileId);
    }
  }, [inlineImportProfileId, profileId, profilesQuery.data]);

  useEffect(() => {
    const runtimeOptions = runtimeOptionsQuery.data;
    if (!runtimeOptions) {
      return;
    }
    setInlineDraft((current) => {
      const base = current || createInlineDraftFromScratch();
      const next = normalizeInlineDraftWithSessionRuntimeOptions(base, runtimeOptions);
      return current && sameInlineSetup(current, next) ? current : next;
    });
  }, [runtimeOptionsQuery.data]);

  useEffect(() => {
    if (chatQuery.data === null) {
      setProjection(null);
      return;
    }
    if (chatQuery.data) {
      const loaded = readLoadedChatSessionState(chatQuery.data);
      setProjection(loaded.projection);
      if (chatQuery.data.id !== lastSyncedChatIDRef.current) {
        lastSyncedChatIDRef.current = chatQuery.data.id;
        setMode(loaded.mode);
        setProfileId(loaded.profileId);
        if (loaded.inlineDraft) {
          setInlineDraft(loaded.inlineDraft);
        }
      }
    }
  }, [chatQuery.data]);

  const canSend = useMemo(
    () => readCanSendChatRun({
      chatIdReady: Boolean(normalizedChatID),
      loadedChatView,
      loading: normalizedChatID ? chatQuery.isLoading : false,
      mode,
      profileId,
      inlineDraft,
    }),
    [chatQuery.isLoading, inlineDraft, loadedChatView, mode, profileId, normalizedChatID],
  );

  const setupDirty = useMemo(() => {
    if (!normalizedChatID || loadedChatView === undefined) {
      return false;
    }
    return hasPendingSetupChange(loadedChatView, mode, profileId, inlineDraft);
  }, [inlineDraft, loadedChatView, mode, normalizedChatID, profileId]);

  function syncProjectionFromView(loadedView: ReturnType<typeof readLoadedChatSessionState>) {
    setProjection(loadedView.projection);
  }

  async function withBusy(task: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage("");
    try {
      await task();
    } catch (error: unknown) {
      setErrorMessage(requestErrorMessage(error, "Request failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function ensureChatSession(request: ChatSetupRequest, key: string): Promise<ChatView> {
    if (!key) {
      throw new Error("Cannot create a session without complete setup.");
    }
    if (sessionCreateFlight.current?.key === key) {
      return sessionCreateFlight.current.promise;
    }

    const createTask = (async () => {
      const view = await createChat(request);
      const createdChatID = view.id.trim();
      if (!createdChatID) {
        throw new Error("Chat API returned empty session id.");
      }
      if (latestSetupKey.current === key && !activeChatIDRef.current) {
        activeChatIDRef.current = createdChatID;
        setChatId(createdChatID);
        navigate(chatRoute(createdChatID), { replace: true });
        void chatListQuery.mutate();
        syncProjectionFromView(readLoadedChatSessionState(view));
      }
      setStatusMessage("Session setup is ready.");
      return view;
    })();

    const tracked = createTask.finally(() => {
      if (sessionCreateFlight.current?.key === key) {
        sessionCreateFlight.current = null;
      }
    });

    sessionCreateFlight.current = { key, promise: tracked };
    return tracked;
  }

  async function ensureSetupReady() {
    if (normalizedChatID && loadedChatView !== undefined && !setupDirty) {
      return;
    }
    setIsSavingSetup(true);
    setErrorMessage("");
    try {
      const request = buildChatSetupRequest(mode, profileId, inlineDraft);
      const view = normalizedChatID
        ? await putChat(normalizedChatID, request)
        : await ensureChatSession(request, setupKey);
      const createdChatID = view.id.trim();
      if (!createdChatID) {
        throw new Error("Chat API returned empty session id.");
      }
      if (normalizedChatID) {
        await chatQuery.mutate(view, { revalidate: false });
        void chatListQuery.mutate();
      } else if (!activeChatIDRef.current) {
        activeChatIDRef.current = createdChatID;
        setChatId(createdChatID);
        navigate(chatRoute(createdChatID), { replace: true });
        void chatListQuery.mutate();
      }
      syncProjectionFromView(readLoadedChatSessionState(view));
      setStatusMessage("Session setup is ready.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  function updateInlineDraft(update: (current: ChatInlineSetup) => ChatInlineSetup) {
    setInlineDraft((current) => {
      const base = current || createInlineDraftFromScratch();
      return update(cloneInlineSetup(base));
    });
  }

  const panelActions = createChatSessionPanelActions({
    canEditMode: !modeLocked,
    setMode,
    setProfileId,
    setInlineImportProfileId,
    onImportInlineProfile: () => {
      void withBusy(async () => {
        const draft = await importInlineSetupFromProfile(inlineImportProfileId);
        const runtimeOptions = runtimeOptionsQuery.data || EMPTY_SESSION_RUNTIME_OPTIONS;
        setInlineDraft(normalizeInlineDraftWithSessionRuntimeOptions(draft, runtimeOptions));
        setInlineRuntimeOpen(false);
        setStatusMessage(`Imported inline draft from profile ${inlineImportProfileId}.`);
      });
    },
    setInlineRuntimeOpen,
    updateInlineDraft,
    runtimeOptions: runtimeOptionsQuery.data || EMPTY_SESSION_RUNTIME_OPTIONS,
  });

  const panelState = createChatSessionPanelState({
    mode,
    modeLocked,
    setupDirty,
    currentModelId: projection?.usage?.modelId || undefined,
    profileId,
    inlineImportProfileId,
    inlineDraft,
    inlineRuntimeOpen,
    profiles: profilesQuery.data || [],
    profilesLoading: profilesQuery.isLoading,
    runtimeOptions: runtimeOptionsQuery.data || EMPTY_SESSION_RUNTIME_OPTIONS,
    runtimeOptionsLoading: runtimeOptionsQuery.isLoading,
    busy: panelBusy,
  });

  return {
    chatList: {
      items: chatListQuery.data?.items || [],
      activeChatId: normalizedChatID,
      loading: chatListQuery.isLoading,
      onSelect: (nextChatID: string) => navigate(chatRoute(nextChatID)),
      onNew: () => {
        setStatusMessage("");
        navigate("/chat/new");
      },
    },
    panelState,
    panelActions,
    stage: {
      busy: panelBusy,
      chatId: normalizedChatID,
      sessionId: loadedSessionID,
      setupDirty,
      projection,
      canSend: canSend && !messagesQuery.isLoading,
      messages: messagesQuery.data || [],
      onBeforeRun: ensureSetupReady,
      onError: (message: string) => setErrorMessage(message),
      onStateChange: (state) => setProjection(parseProjectionState(state)),
    },
    errorMessage: firstErrorMessage(errorMessage, chatListQuery.error, profilesQuery.error, runtimeOptionsQuery.error, chatQuery.error, messagesQuery.error),
    statusMessage,
  };
}

function chatRoute(chatID: string) {
  return `/chat/${encodeURIComponent(chatID)}`;
}

function createInlineDraftFromScratch(): ChatInlineSetup {
  return {
    providerId: "",
    executionClass: "",
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      fallbacks: [],
    }),
    resourceConfig: create(AgentResourcesSchema, {}),
  };
}
