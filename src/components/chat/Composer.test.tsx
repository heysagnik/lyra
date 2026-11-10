import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "./Composer";

describe("Composer Component", () => {
  it("disables send button when textarea is empty", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
        searchDefault={true}
      />
    );

    const sendButton = screen.getByLabelText("Send message") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it("calls onSend with typed text and search toggle state", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
        searchDefault={true}
      />
    );

    const textarea = screen.getByPlaceholderText("Ask Aria anything…");
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    const sendButton = screen.getByLabelText("Send message") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith("Hello world", true);
  });

  it("shows stop button when isStreaming is true and triggers onStop", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={true}
        onStop={handleStop}
        searchDefault={true}
      />
    );

    const stopButton = screen.getByLabelText("Stop generating");
    expect(stopButton).not.toBeNull();
    fireEvent.click(stopButton);
    expect(handleStop).toHaveBeenCalled();
  });
});
