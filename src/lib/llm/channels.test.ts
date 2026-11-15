import { describe, it, expect } from "vitest";
import {
  splitChannelText,
  hasChannelMarkers,
  createChannelStreamTransformer,
} from "./channels";

describe("splitChannelText", () => {
  it("returns plain text untouched", () => {
    const r = splitChannelText("Just an answer.");
    expect(r.reasoning).toBe("");
    expect(r.content).toBe("Just an answer.");
  });

  it("splits the malformed NIM variant observed in production", () => {
    const r = splitChannelText("<|channel>thought\nreason here<channel|>Answer.");
    expect(r.reasoning).toBe("reason here");
    expect(r.content).toBe("Answer.");
  });

  it("splits canonical harmony output", () => {
    const r = splitChannelText(
      "<|channel|>thought<|message|>think here<|end|><|start|>assistant<|channel|>final<|message|>Answer [1]."
    );
    expect(r.reasoning).toBe("think here");
    expect(r.content).toBe("Answer [1].");
  });

  it("splits generic think tags", () => {
    const r = splitChannelText("<think>hidden</think>Visible.");
    expect(r.reasoning).toBe("hidden");
    expect(r.content).toBe("Visible.");
  });

  it("strips trailing noise tokens from the answer", () => {
    const r = splitChannelText("<|channel>thought\nr<channel|>A. <|end|>");
    expect(r.reasoning).toBe("r");
    expect(r.content).toBe("A.");
  });

  it("keeps text that only looks like a marker prefix", () => {
    const r = splitChannelText("<|chatty text about channels");
    expect(r.reasoning).toBe("");
    expect(r.content).toBe("<|chatty text about channels");
  });

  it("degrades gracefully when the thought channel never closes", () => {
    const r = splitChannelText("<|channel>thought\nstill thinking");
    expect(r.reasoning).toContain("still thinking");
    expect(r.content).toBe("");
  });
});

describe("hasChannelMarkers", () => {
  it("detects markers", () => {
    expect(hasChannelMarkers("<|channel>thought")).toBe(true);
    expect(hasChannelMarkers("x<channel|>y")).toBe(true);
    expect(hasChannelMarkers("rawAnswer text")).toBe(false);
  });
});

describe("createChannelStreamTransformer", () => {
  async function collect(deltas: string[]) {
    const parts: Array<{ type: string; delta?: string; text?: string }> = [];
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "t1" });
        for (const d of deltas) {
          controller.enqueue({ type: "text-delta", id: "t1", delta: d });
        }
        controller.enqueue({ type: "text-end", id: "t1" });
        controller.close();
      },
    });
    await source
      .pipeThrough(createChannelStreamTransformer())
      .pipeTo(new WritableStream({ write: (p) => void parts.push(p) }));
    return parts;
  }

  it("emits reasoning before text across split deltas", async () => {
    const parts = await collect(["<|cha", "nnel>thought\nreason<chan", "nel|>final answer"]);
    const types = parts.map((p) => p.type);
    expect(types).toEqual([
      "reasoning-start",
      "reasoning-delta",
      "reasoning-end",
      "text-start",
      "text-delta",
      "text-end",
    ]);
    expect(parts.filter((p) => p.type === "reasoning-delta").map((p) => p.delta).join("")).toBe(
      "\nreason"
    );
    expect(parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("")).toBe(
      "final answer"
    );
  });

  it("survives 1-char deltas splitting every marker", async () => {
    const parts = await collect("<|channel>thought\nthink<channel|>Answer".split(""));
    const reasoning = parts.filter((p) => p.type === "reasoning-delta").map((p) => p.delta).join("");
    const text = parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("");
    expect(reasoning).toBe("\nthink");
    expect(text).toBe("Answer");
  });

  it("passes plain text through as one text part", async () => {
    const parts = await collect(["Hello, ", "world."]);
    const types = parts.map((p) => p.type);
    expect(types).toEqual(["text-start", "text-delta", "text-delta", "text-end"]);
    expect(parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("")).toBe(
      "Hello, world."
    );
  });

  it("does not false-positive on marker-like prefixes", async () => {
    const parts = await collect(["<|chatty text"]);
    const text = parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("");
    expect(text).toBe("<|chatty text");
    expect(parts.some((p) => p.type.startsWith("reasoning"))).toBe(false);
  });

  it("closes an unterminated thought channel at stream end", async () => {
    const parts = await collect(["<|channel>thought\nstill thinking"]);
    expect(parts.some((p) => p.type === "reasoning-end")).toBe(true);
    // No answer was produced; no empty text part is emitted.
    expect(parts.some((p) => p.type === "text-end")).toBe(false);
  });
});
