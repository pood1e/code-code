import { ChatSessionStage } from "./chat-session-stage";
import { ChatSessionList } from "./chat-session-list";
import { ChatSessionToolbar } from "./chat-session-toolbar";
import { useChatSessionCardController } from "../use-chat-session-card-controller";

export function ChatSessionCard() {
  const { chatList, panelState, panelActions, stage, errorMessage, statusMessage } = useChatSessionCardController();

  return (
    <div className="chatWorkbench">
      <ChatSessionList {...chatList} />
      <div className="chatWorkbenchContent">
        <ChatSessionToolbar
          state={panelState}
          actions={panelActions}
          errorMessage={errorMessage}
          statusMessage={statusMessage}
        />
        <div className="chatWorkbenchMain">
          <ChatSessionStage {...stage} />
        </div>
      </div>
    </div>
  );
}
