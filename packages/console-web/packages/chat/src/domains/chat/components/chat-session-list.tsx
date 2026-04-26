import { Button, Text } from "@radix-ui/themes";
import type { ChatListController } from "../use-chat-session-card-controller";

type Props = ChatListController;

export function ChatSessionList({ items, activeChatId, loading, onSelect, onNew }: Props) {
  return (
    <aside className="chatSessionList" aria-label="Chats">
      <div className="chatSessionListHeader">
        <Text size="2" weight="medium">Chats</Text>
        <Button className="chatSessionListNewButton" variant="soft" size="1" onClick={onNew} aria-label="New chat">
          <NewChatIcon />
          New
        </Button>
      </div>
      <div className="chatSessionListItems">
        {items.length === 0 && (
          <Text size="1" color="gray" className="chatSessionListEmpty">
            {loading ? "Loading chats..." : "No chats yet"}
          </Text>
        )}
        {items.map((item) => {
          const label = item.displayName?.trim() || item.id;
          const active = item.id === activeChatId;
          return (
            <button
              key={item.id}
              type="button"
              className="chatSessionListItem"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span className="chatSessionListItemName">{label}</span>
              {item.sessionId && item.sessionId !== item.id && (
                <span className="chatSessionListItemMeta">{item.sessionId}</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
