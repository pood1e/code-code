import { lazy } from "react";

const ChatPage = lazy(() =>
  import("./pages/chat").then((m) => ({ default: m.ChatPage }))
);

export const CHAT_ROUTES = [
  { path: "chat", element: <ChatPage /> },
  { path: "chat/:chatId", element: <ChatPage /> },
];
