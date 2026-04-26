import { ChatWorkbenchStyles } from "../domains/chat/chat-workbench-styles";
import { ChatSessionCard } from "../domains/chat/components/chat-session-card";

export function ChatPage() {
  return (
    <div className="chatPage">
      <ChatWorkbenchStyles />
      <ChatSessionCard />
    </div>
  );
}
