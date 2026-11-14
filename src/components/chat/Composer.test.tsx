import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "./Composer";

describe("Composer Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("disables send button when textarea is empty", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
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
      />
    );

    const textarea = screen.getByPlaceholderText("Message lyra");
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    const sendButton = screen.getByLabelText("Send message") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith("Hello world", true, "primary", "standard");
  });

  it("shows stop button when isStreaming is true and triggers onStop", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={true}
        onStop={handleStop}
      />
    );

    const stopButton = screen.getByLabelText("Stop generating");
    expect(stopButton).not.toBeNull();
    fireEvent.click(stopButton);
    expect(handleStop).toHaveBeenCalled();
  });

  it("renders attachment card with extension pill and removes it on click", async () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["# Documentation"], "AGENT.md", { type: "text/markdown" });
    file.text = vi.fn().mockResolvedValue("# Documentation");

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("AGENT.md")).toBeDefined();
    expect(screen.getByText("MD")).toBeDefined();

    const removeBtn = screen.getByLabelText("Remove AGENT.md");
    fireEvent.click(removeBtn);

    expect(screen.queryByText("AGENT.md")).toBeNull();
  });

  it("locks the models but allows changing effort when isModelLocked is true", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
        isModelLocked={true}
      />
    );

    // Button opens the popover so effort can be changed
    const pickerButton = screen.getByTitle("Choose effort (model locked)");
    expect(pickerButton).toBeDefined();
    fireEvent.click(pickerButton);

    // The models are not shown when locked
    expect(screen.queryByRole("option")).toBeNull();

    // But the effort slider can be changed
    const highBtn = screen.getByLabelText("Set effort to High");
    fireEvent.click(highBtn);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);

    // Type and send — uses locked model ("primary") and new effort ("max")
    const textarea = screen.getByPlaceholderText("Message lyra");
    fireEvent.change(textarea, { target: { value: "Follow up question" } });

    const sendButton = screen.getByLabelText("Send message");
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith(
      "Follow up question",
      true,
      "primary",
      "max"
    );
  });

  it("allows selecting another registered model when unlocked", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
        isModelLocked={false}
      />
    );

    const modelButton = screen.getByTitle("Choose model");
    fireEvent.click(modelButton);

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Select GPT-OSS 20B
    const gptOssOption = options.find((opt) => opt.textContent?.includes("GPT-OSS 20B"));
    expect(gptOssOption).toBeDefined();
    if (gptOssOption) {
      fireEvent.click(gptOssOption);
    }

    // Type and send
    const textarea = screen.getByPlaceholderText("Message lyra");
    fireEvent.change(textarea, { target: { value: "Testing model switch" } });

    const sendButton = screen.getByLabelText("Send message");
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith("Testing model switch", true, "gpt-oss-20b", "standard");
  });

  it("adjusts effort level via the slider and sends with selected effort", () => {
    const handleSend = vi.fn();
    const handleStop = vi.fn();

    render(
      <Composer
        onSend={handleSend}
        isStreaming={false}
        onStop={handleStop}
        isModelLocked={false}
      />
    );

    // Open model & effort popover
    const modelButton = screen.getByTitle("Choose model");
    fireEvent.click(modelButton);

    // Default effort label should be Medium (slider header + trigger badge)
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);

    // Click high effort stop
    const highBtn = screen.getByLabelText("Set effort to High");
    fireEvent.click(highBtn);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);

    // Type and send
    const textarea = screen.getByPlaceholderText("Message lyra");
    fireEvent.change(textarea, { target: { value: "Complex itinerary request" } });

    const sendButton = screen.getByLabelText("Send message");
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith(
      "Complex itinerary request",
      true,
      "primary",
      "max"
    );
  });
});
