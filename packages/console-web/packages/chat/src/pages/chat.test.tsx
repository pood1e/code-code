import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ChatPage } from "./chat";

vi.mock("../domains/chat/components/chat-session-card", () => ({
  ChatSessionCard: () => <section><h2>Chat Session</h2></section>,
}));

describe("ChatPage", () => {
  it("renders standalone chat entry", () => {
    render(
      <MemoryRouter>
        <Theme>
          <ChatPage />
        </Theme>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Chat Session" })).toBeTruthy();
  });
});
