"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUpIcon,
  SquareIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { REGISTERED_MODELS } from "@/lib/llm/models";
import { ModelPicker, type EffortLevel } from "./ModelPicker";
import toast from "react-hot-toast";

export interface ComposerProps {
  onSend: (
    text: string,
    search: boolean,
    model: string,
    effort?: "low" | "standard" | "max"
  ) => void;
  isStreaming: boolean;
  onStop: () => void;
  retryAfterSeconds?: number;
}

const MODEL_STORAGE_KEY = "lyra-model";
const EFFORT_STORAGE_KEY = "lyra-effort";

const ATTACHABLE_TYPES =
  /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml))$/;
const MAX_ATTACH_CHARS = 50_000;

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length > 1) {
    const ext = parts.pop()?.toUpperCase() || "";
    return ext.slice(0, 4);
  }
  return "TXT";
}

export function Composer({
  onSend,
  isStreaming,
  onStop,
  retryAfterSeconds,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [countdown, setCountdown] = useState<number | undefined>(retryAfterSeconds);
  const [model, setModel] = useState<string>(() => {
    // Restore the last-used model synchronously so the trigger never flashes
    // the default. Stale ids from removed models fall back to the default.
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved) {
        if (REGISTERED_MODELS.some((m) => m.id === saved || m.modelId === saved)) {
          return saved;
        }
        if (saved === "primary" || saved === "fallback") {
          const def = REGISTERED_MODELS.find((m) => m.isDefaultPrimary);
          if (def) return def.id;
        }
      }
    } catch {
    }
    return "primary";
  });
  const [effort, setEffort] = useState<EffortLevel>("standard");
  const [attachments, setAttachments] = useState<
    { name: string; content: string; size?: number }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (!ATTACHABLE_TYPES.test(file.type) && !/\.(txt|md|json|csv|ya?ml|tsx?|jsx?|py|sql|css|html?)$/i.test(file.name)) {
        toast.error(`“${file.name}” is not a text file — only text, code, and data files can be attached.`);
        continue;
      }
      if (next.some((a) => a.name === file.name)) continue;
      const content =
        typeof file.text === "function"
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string) || "");
              reader.onerror = reject;
              reader.readAsText(file);
            });
      if (content.length > MAX_ATTACH_CHARS) {
        toast.error(`“${file.name}” is too large to attach (over ~50 KB).`);
        continue;
      }
      next.push({ name: file.name, content, size: file.size });
    }
    setAttachments(next);
  };

  useEffect(() => {
    try {
      const savedEffort = localStorage.getItem(EFFORT_STORAGE_KEY);
      if (savedEffort === "low" || savedEffort === "standard" || savedEffort === "max") {
        setEffort(savedEffort);
      }
    } catch {
    }
  }, []);

  const handleModelChange = (id: string) => {
    setModel(id);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {}
  };

  const handleEffortChange = (nextEffort: EffortLevel) => {
    setEffort(nextEffort);
    try {
      localStorage.setItem(EFFORT_STORAGE_KEY, nextEffort);
    } catch {
    }
  };

  useEffect(() => {
    if (!retryAfterSeconds || retryAfterSeconds <= 0) {
      setCountdown(undefined);
      return;
    }
    setCountdown(retryAfterSeconds);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          return undefined;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isStreaming) {
      onStop();
      return;
    }
    if ((!text.trim() && attachments.length === 0) || countdown !== undefined) return;
    let prompt = text.trim();
    for (const a of attachments) {
      prompt += prompt ? `\n\n` : ``;
      prompt += `Attached file “${a.name}”:\n\`\`\`\n${a.content}\n\`\`\``;
    }
    onSend(prompt, true, model, effort);
    setText("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const canSend =
    !isStreaming &&
    (!!text.trim() || attachments.length > 0) &&
    countdown === undefined;

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-[var(--radius-composer)] border ${
          isDragging
            ? "border-[var(--color-focus)] bg-[var(--color-surface-2)] shadow-[var(--shadow-composer-focus)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-composer)]"
        } transition-[border-color,background-color] duration-[var(--duration-normal)] focus-within:border-[var(--color-border-strong)] focus-within:shadow-[var(--shadow-composer-focus)]`}
      >
        {/* Attachments — simple one-line chips, horizontal scroll */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-3 pb-1 sm:gap-2 sm:px-4 scrollbar-none">
            {attachments.map((a) => {
              const ext = getFileExtension(a.name);
              return (
                <div
                  key={a.name}
                  className="attach-in group flex h-7 max-w-[60vw] shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-canvas)] pl-2 pr-1 transition-[border-color,background-color] duration-[var(--duration-fast)] hover:border-[var(--color-accent)]/40"
                >
                  <span
                    aria-hidden
                    className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-[var(--color-text-secondary)]"
                  >
                    {ext}
                  </span>
                  <span
                    title={a.name}
                    className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-[var(--color-text)] sm:text-xs"
                  >
                    {a.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.name !== a.name))
                    }
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-[background-color,color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-text)] active:scale-[0.96]"
                  >
                    <XIcon aria-hidden className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={countdown !== undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            countdown
              ? `Rate limit reached — try again in ${countdown}s…`
              : "Message lyra"
          }
          className="w-full resize-none border-0 bg-transparent px-4 pb-2 pt-3.5 text-base leading-relaxed text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus-visible:outline-none sm:px-5 sm:pt-4 sm:text-[15px]"
        />

        {/* Controls row */}
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          {/* Attach files */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.yml,.yaml,.ts,.tsx,.js,.jsx,.py,.sql,.css,.html,text/*"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Attach files"
            title="Attach text, code, or data files"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-[color,border-color,transform] duration-[var(--duration-normal)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] active:scale-[0.96]"
          >
            <PlusIcon className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <ModelPicker
              model={model}
              onModelChange={handleModelChange}
              effort={effort}
              onEffortChange={handleEffortChange}
            />

            {/* Send / Stop — always present, matching the reference */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] transition-[transform,opacity] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96]"
              >
                <SquareIcon className="h-2.5 w-2.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
                className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] active:scale-[0.96] ${
                  canSend
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
                    : "cursor-not-allowed bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)]"
                }`}
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
