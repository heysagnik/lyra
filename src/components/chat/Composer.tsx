"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, ChevronDown, Check, Plus, X } from "lucide-react";

export interface ComposerProps {
  onSend: (text: string, search: boolean, model: "primary" | "fallback") => void;
  isStreaming: boolean;
  onStop: () => void;
  retryAfterSeconds?: number;
}

/** The two models the backend actually serves (GROQ_MODEL_PRIMARY / FALLBACK). */
const MODELS = [
  { id: "primary" as const, label: "Qwen 3.8 27B" },
  { id: "fallback" as const, label: "GPT-OSS 20B" },
];

const MODEL_STORAGE_KEY = "lyra-model";

/** Text-based file kinds the text-only LLM can actually consume. */
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

function formatFileSize(bytes?: number): string | null {
  if (bytes === undefined || isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function Composer({
  onSend,
  isStreaming,
  onStop,
  retryAfterSeconds,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [countdown, setCountdown] = useState<number | undefined>(retryAfterSeconds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [model, setModel] = useState<"primary" | "fallback">("primary");
  const [attachments, setAttachments] = useState<
    { name: string; content: string; size?: number }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachError(null);
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (!ATTACHABLE_TYPES.test(file.type) && !/\.(txt|md|json|csv|ya?ml|tsx?|jsx?|py|sql|css|html?)$/i.test(file.name)) {
        setAttachError(`“${file.name}” is not a text file — only text, code, and data files can be attached.`);
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
        setAttachError(`“${file.name}” is too large to attach (over ~50 KB).`);
        continue;
      }
      next.push({ name: file.name, content, size: file.size });
    }
    setAttachments(next);
  };

  // Restore persisted model choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved === "primary" || saved === "fallback") setModel(saved);
    } catch {
      // ignore
    }
  }, []);

  // Close the picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [pickerOpen]);

  // Handle 429 countdown
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

  // Autosize textarea
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
    onSend(prompt, true, model);
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
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? "";

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
        className={`rounded-[22px] border ${
          isDragging
            ? "border-[var(--color-focus)] bg-[var(--color-surface-2)] shadow-[var(--shadow-composer-focus)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-composer)]"
        } transition-[border-color,background-color] duration-[var(--duration-normal)] focus-within:border-[var(--color-border-strong)] focus-within:shadow-[var(--shadow-composer-focus)]`}
      >
        {/* Attachment cards matching Claude/Kimi card UX */}
        {attachments.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto px-3.5 pt-3.5 pb-1 sm:px-4 scrollbar-none">
            {attachments.map((a) => {
              const ext = getFileExtension(a.name);
              const formattedSize = formatFileSize(a.size);
              return (
                <div
                  key={a.name}
                  className="group relative flex h-[132px] w-[132px] shrink-0 flex-col justify-between rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] p-3 shadow-sm transition-all duration-[var(--duration-fast)] hover:border-white/20 sm:h-[136px] sm:w-[136px] sm:p-3.5"
                >
                  {/* Top: Name & Remove button */}
                  <div className="flex items-start justify-between gap-1">
                    <span
                      title={a.name}
                      className="truncate text-[13px] font-medium leading-tight text-[var(--color-text)]"
                    >
                      {a.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      onClick={() =>
                        setAttachments((prev) => prev.filter((x) => x.name !== a.name))
                      }
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[var(--color-text-tertiary)] transition-all hover:bg-white/15 hover:text-[var(--color-text)]"
                    >
                      <X aria-hidden className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Bottom: Extension pill & optional file size */}
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--color-text-secondary)]">
                      {ext}
                    </span>
                    {formattedSize && (
                      <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                        {formattedSize}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {attachError && (
          <p role="alert" className="px-5 pt-2 text-xs text-[var(--color-danger)]">
            {attachError}
          </p>
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
              : "Send a Message"
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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-[color,border-color,transform] duration-[var(--duration-normal)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] active:scale-[0.96]"
          >
            <Plus className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            {/* Model picker */}
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen(!pickerOpen)}
                className="flex items-center gap-1 rounded-[var(--radius-lg)] px-1.5 py-1 text-sm text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--color-hover)] active:scale-[0.97]"
              >
                <span>{modelLabel}</span>
                <ChevronDown
                  aria-hidden
                  className={`h-3.5 w-3.5 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-normal)] ${
                    pickerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {pickerOpen && (
                <div className="popover-in-up absolute bottom-full right-0 z-30 mb-2 w-52 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-dialog)]">
                  <div role="listbox" aria-label="Model" className="space-y-0.5">
                    {MODELS.map((m) => {
                      const selected = m.id === model;
                      return (
                        <button
                          key={m.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setModel(m.id);
                            try {
                              localStorage.setItem(MODEL_STORAGE_KEY, m.id);
                            } catch {
                              // ignore
                            }
                            setPickerOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm transition-colors duration-[var(--duration-fast)] ${
                            selected
                              ? "bg-[var(--color-surface-3)] text-[var(--color-text)]"
                              : "text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                          }`}
                        >
                          <span>{m.label}</span>
                          {selected && (
                            <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>

            {/* Send / Stop — always present, matching the reference */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] transition-[transform,opacity] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96]"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] duration-[var(--duration-fast)] active:scale-[0.96] ${
                  canSend
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
                    : "cursor-not-allowed bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)]"
                }`}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
