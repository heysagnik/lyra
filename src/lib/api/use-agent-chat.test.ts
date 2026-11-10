import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentChat } from "./use-agent-chat";

// Mock @ai-sdk/react useChat
vi.mock("@ai-sdk/react", () => {
  return {
    useChat: vi.fn(({ onData }) => {
      return {
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Hello",
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "Hi!",
            parts: [
              {
                type: "data-sources",
                data: {
                  items: [
                    {
                      title: "Example",
                      url: "https://example.com",
                      snippet: "A snippet",
                    },
                  ],
                },
              },
            ],
          },
        ],
        sendMessage: vi.fn().mockImplementation(() => {
          if (onData) {
            onData({
              type: "data-meta",
              data: { conversationId: "new-conv-id", title: "New Chat" },
            });
          }
          return Promise.resolve();
        }),
        status: "ready",
        stop: vi.fn(),
        error: undefined,
        clearError: vi.fn(),
        setMessages: vi.fn(),
      };
    }),
  };
});

describe("useAgentChat hook", () => {
  it("wraps AI SDK useChat and captures data parts", async () => {
    const handleCreated = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat({
        conversationId: "conv-initial",
        searchDefault: true,
        onConversationCreated: handleCreated,
      })
    );

    expect(result.current.conversationId).toBe("conv-initial");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].sources).toHaveLength(1);
    expect(result.current.messages[1].sources?.[0].title).toBe("Example");

    await act(async () => {
      await result.current.sendMessage("How are you?");
    });

    expect(handleCreated).toHaveBeenCalledWith("new-conv-id", "New Chat");
  });
});
