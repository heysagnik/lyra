
const THOUGHT_START_MARKERS = [
  "<|channel|>thought<|message|>", // canonical harmony
  "<|channel|>thought",
  "<|channel>thought", // malformed variant observed from NIM
  "<think>",
];

const THOUGHT_END_MARKERS = [
  "<|end|><|start|>assistant<|channel|>final<|message|>", // canonical harmony
  "<|channel|>final<|message|>",
  "<|channel|>final",
  "<channel|>", // malformed variant observed from NIM
  "</think>",
];

const STRAY_MARKERS = [
  "<|end|>",
  "<|return|>",
  "<|message|>",
  "<|start|>",
  "<|channel|>",
  "<|channel>",
];

const ALL_MARKERS = [...THOUGHT_START_MARKERS, ...THOUGHT_END_MARKERS, ...STRAY_MARKERS];

/** Longest marker length, minus 1 — the tail we must hold back while streaming. */
const HOLD_BACK = Math.max(...ALL_MARKERS.map((m) => m.length)) - 1;

export function hasChannelMarkers(text: string): boolean {
  return text.includes("<|") || text.includes("<channel|>") || text.includes("<think>");
}

/**
 * Split a complete text (persisted content, or a full generate call) into its
 * reasoning channel and its final answer. Never throws; malformed or absent
 * markers degrade to "everything is content".
 */
export function splitChannelText(raw: string): { reasoning: string; content: string } {
  if (!hasChannelMarkers(raw)) {
    return { reasoning: "", content: raw };
  }

  let rest = raw;
  let reasoning = "";
  let content = "";
  let inThinking = false;

  if (!inThinking) {
    const start = THOUGHT_START_MARKERS.find((m) => rest.startsWith(m));
    if (start) {
      rest = rest.slice(start.length);
      inThinking = true;
    } else {
      inThinking = false;
    }
  }

  while (rest.length > 0) {
    if (inThinking) {
      const ends = THOUGHT_END_MARKERS.map((m) => rest.indexOf(m))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      if (ends.length === 0) {
        reasoning += rest;
        rest = "";
        break;
      }
      const idx = ends[0];
      reasoning += rest.slice(0, idx);
      const marker = THOUGHT_END_MARKERS.find((m) => rest.startsWith(m, idx))!;
      rest = rest.slice(idx + marker.length);
      inThinking = false;
      continue;
    }

    const found = ALL_MARKERS.map((m) => rest.indexOf(m))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (found.length === 0) {
      content += rest;
      rest = "";
      break;
    }
    const idx = found[0];
    content += rest.slice(0, idx);
    const marker = ALL_MARKERS.find((m) => rest.startsWith(m, idx))!;
    if (THOUGHT_START_MARKERS.includes(marker)) {
      inThinking = true;
    }
    rest = rest.slice(idx + marker.length);
  }

  return {
    reasoning: reasoning.replace(/^\n+/, "").trim(),
    content: content.replace(/^\n+/, "").replace(/\s+$/, ""),
  };
}

export function createChannelStreamTransformer(): TransformStream<
  {
    type: string;
    id?: string;
    delta?: string;
    [key: string]: unknown;
  },
  {
    type: string;
    id?: string;
    delta?: string;
    text?: string;
    [key: string]: unknown;
  }
> {
  type State = "undetermined" | "thinking" | "final";
  const reasoningId = "channel-reasoning";

  let state: State = "undetermined";
  let buffer = "";
  let textId = "";
  let textStarted = false;
  let reasoningStarted = false;

  const emit = (controller: TransformStreamDefaultController<Record<string, unknown>>, part: Record<string, unknown>) => {
    controller.enqueue(part);
  };

  const flushSafe = (
    controller: TransformStreamDefaultController<Record<string, unknown>>,
    chunk: string,
    send: (text: string) => void
  ): string => {
    let safeEnd = chunk.length;
    for (let i = Math.max(0, chunk.length - HOLD_BACK); i < chunk.length; i++) {
      const tail = chunk.slice(i);
      if (ALL_MARKERS.some((m) => m.startsWith(tail))) {
        safeEnd = i;
        break;
      }
    }
    if (safeEnd > 0) {
      send(chunk.slice(0, safeEnd));
    }
    return chunk.slice(safeEnd);
  };

  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type !== "text-start" && chunk.type !== "text-delta" && chunk.type !== "text-end") {
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === "text-start") {
        textId = (chunk.id as string) ?? "text";
        textStarted = false;
        return;
      }

      if (chunk.type === "text-delta") {
        buffer += chunk.delta ?? "";

        if (state === "undetermined") {
          const start = THOUGHT_START_MARKERS.find((m) => buffer.startsWith(m));
          if (start) {
            buffer = buffer.slice(start.length);
            state = "thinking";
            reasoningStarted = true;
            emit(controller, { type: "reasoning-start", id: reasoningId });
          } else if (
            buffer.length < Math.max(...THOUGHT_START_MARKERS.map((m) => m.length)) &&
            THOUGHT_START_MARKERS.some((m) => m.startsWith(buffer))
          ) {
            return;
          } else {
            state = "final";
          }
        }

        if (state === "thinking") {
          const ends = THOUGHT_END_MARKERS.map((m) => buffer.indexOf(m))
            .filter((i) => i >= 0)
            .sort((a, b) => a - b);
          if (ends.length > 0) {
            const idx = ends[0];
            const marker = THOUGHT_END_MARKERS.find((m) => buffer.startsWith(m, idx))!;
            if (idx > 0) {
              emit(controller, { type: "reasoning-delta", id: reasoningId, delta: buffer.slice(0, idx) });
            }
            emit(controller, { type: "reasoning-end", id: reasoningId });
            reasoningStarted = false;
            buffer = buffer.slice(idx + marker.length);
            state = "final";
          } else {
            buffer = flushSafe(controller, buffer, (text) => {
              emit(controller, { type: "reasoning-delta", id: reasoningId, delta: text });
            });
            return;
          }
        }

        if (state === "final") {
          // Cut the buffer at the first stray/thought marker so it (and
          // everything after) is not sent as answer text.
          const found = ALL_MARKERS.map((m) => buffer.indexOf(m))
            .filter((i) => i >= 0)
            .sort((a, b) => a - b);
          let sendable = buffer;
          let remainder = "";
          if (found.length > 0) {
            const idx = found[0];
            const marker = ALL_MARKERS.find((m) => buffer.startsWith(m, idx))!;
            sendable = buffer.slice(0, idx);
            remainder = buffer.slice(idx + marker.length);
          }
          if (!textStarted) {
            emit(controller, { type: "text-start", id: textId });
            textStarted = true;
          }
          // Hold back a partial-marker tail only from `sendable`'s end; the
          // tail stays pending in the buffer so the next delta can complete
          // (or dismiss) the marker it may be growing into.
          const heldBack = flushSafe(controller, sendable, (text) => {
            if (text) emit(controller, { type: "text-delta", id: textId, delta: text });
          });
          buffer = heldBack + remainder;
          return;
        }
      }

      if (chunk.type === "text-end") {
        if (state === "undetermined") {
          if (buffer) {
            emit(controller, { type: "text-start", id: textId });
            emit(controller, { type: "text-delta", id: textId, delta: buffer });
          }
          emit(controller, { type: "text-end", id: textId });
        } else if (state === "thinking") {
          if (buffer) {
            const cleaned = splitChannelText(buffer);
            if (cleaned.reasoning && reasoningStarted) {
              emit(controller, { type: "reasoning-delta", id: reasoningId, delta: cleaned.reasoning });
            }
            if (cleaned.content) {
              if (!textStarted) emit(controller, { type: "text-start", id: textId });
              emit(controller, { type: "text-delta", id: textId, delta: cleaned.content });
            }
          }
          if (reasoningStarted) {
            emit(controller, { type: "reasoning-end", id: reasoningId });
          }
          if (textStarted) {
            emit(controller, { type: "text-end", id: textId });
          }
        } else if (state === "final") {
          if (buffer) {
            const cleaned = splitChannelText(buffer);
            if (cleaned.content) {
              if (!textStarted) emit(controller, { type: "text-start", id: textId });
              emit(controller, { type: "text-delta", id: textId, delta: cleaned.content });
            }
            if (cleaned.reasoning && !reasoningStarted) {
              emit(controller, { type: "reasoning-start", id: reasoningId });
              emit(controller, { type: "reasoning-delta", id: reasoningId, delta: cleaned.reasoning });
              emit(controller, { type: "reasoning-end", id: reasoningId });
            }
          }
          if (!textStarted) emit(controller, { type: "text-start", id: textId });
          emit(controller, { type: "text-end", id: textId });
        }
        state = "undetermined";
        buffer = "";
        textStarted = false;
        reasoningStarted = false;
      }
    },
  });
}

import type { LanguageModelMiddleware } from "ai";

export const channelReasoningMiddleware: LanguageModelMiddleware = {
  wrapStream: async ({ doStream }) => {
    const result = await doStream();
    return {
      ...result,
      stream: result.stream.pipeThrough(
        createChannelStreamTransformer() as unknown as TransformStream<
          (typeof result.stream) extends ReadableStream<infer T> ? T : never,
          (typeof result.stream) extends ReadableStream<infer T> ? T : never
        >
      ),
    };
  },
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    const content = result.content.map((part) => {
      if (part.type !== "text" || typeof part.text !== "string") return part;
      if (!hasChannelMarkers(part.text)) return part;
      const split = splitChannelText(part.text);
      const parts: Array<Record<string, unknown>> = [];
      if (split.reasoning) {
        parts.push({ type: "reasoning", text: split.reasoning });
      }
      if (split.content) {
        parts.push({ type: "text", text: split.content });
      }
      return parts;
    });
    return {
      ...result,
      content: content.flat() as typeof result.content,
    };
  },
};
