"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUpIcon,
  SquareIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { REGISTERED_MODELS } from "@/lib/llm/models";
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
  isModelLocked?: boolean;
  /** Model recorded on the locked conversation, shown while switching is disabled. */
  lockedModel?: string | null;
}

const MODEL_STORAGE_KEY = "lyra-model";
const EFFORT_STORAGE_KEY = "lyra-effort";

export type EffortLevel = "low" | "standard" | "max";

export const EFFORT_LEVELS: { id: EffortLevel; label: string; index: number }[] = [
  { id: "low", label: "Low", index: 0 },
  { id: "standard", label: "Medium", index: 1 },
  { id: "max", label: "High", index: 2 },
];

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

export function Composer({
  onSend,
  isStreaming,
  onStop,
  retryAfterSeconds,
  isModelLocked = false,
  lockedModel,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [countdown, setCountdown] = useState<number | undefined>(retryAfterSeconds);
  const [pickerOpen, setPickerOpen] = useState(false);
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
      // ignore
    }
    return "primary";
  });
  const [effort, setEffort] = useState<EffortLevel>("standard");
  const [attachments, setAttachments] = useState<
    { name: string; content: string; size?: number }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
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

  // Restore persisted effort; model is restored synchronously in useState
  useEffect(() => {
    try {
      const savedEffort = localStorage.getItem(EFFORT_STORAGE_KEY);
      if (savedEffort === "low" || savedEffort === "standard" || savedEffort === "max") {
        setEffort(savedEffort);
      }
    } catch {
      // ignore
    }
  }, []);

  // While a conversation locks the model, display the model that conversation
  // was created with (its first message records it) instead of the global pick.
  useEffect(() => {
    if (!isModelLocked || !lockedModel) return;
    const found = REGISTERED_MODELS.find(
      (m) => m.id === lockedModel || m.modelId === lockedModel
    );
    if (found) setModel(found.id);
  }, [isModelLocked, lockedModel]);

  const handleEffortChange = (nextEffort: EffortLevel) => {
    setEffort(nextEffort);
    try {
      localStorage.setItem(EFFORT_STORAGE_KEY, nextEffort);
    } catch {
      // ignore
    }
  };

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

  const activeModel = REGISTERED_MODELS.find(
    (m) =>
      m.id === model ||
      m.modelId === model ||
      ((model === "primary" || model === "fallback") && m.isDefaultPrimary)
  );
  const modelLabel = activeModel?.label ?? "Nemotron 3.5 Bolt E4B";

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
            {/* Model & Effort picker */}
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                title={
                  isModelLocked
                    ? "Choose effort (model locked)"
                    : "Choose model"
                }
                onClick={() => {
                  setPickerOpen(!pickerOpen);
                }}
                className="flex items-center gap-1 rounded-[var(--radius-lg)] px-1.5 py-1 text-sm text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
              >
                <span className="font-medium text-xs sm:text-sm">{modelLabel}</span>

                <span className="text-[9px] font-semibold text-[var(--color-text-tertiary)] border border-[var(--color-border)]/70 px-1 py-0.5 rounded tracking-wide">
                  {EFFORT_LEVELS.find((e) => e.id === effort)?.label ?? "Medium"}
                </span>
                <CaretDownIcon
                  aria-hidden
                  className={`h-3.5 w-3.5 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-normal)] ${
                    pickerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {pickerOpen && (
                <div className="popover-in-up absolute bottom-full right-0 z-30 mb-2 w-60 sm:w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1.5 shadow-[var(--shadow-popover)] sm:p-2">
                  {!isModelLocked && (
                  <>
                  {/* Scrollable model list */}
                  <div className="max-h-[15rem] overflow-y-auto sm:max-h-[17rem]">
                  <div role="listbox" aria-label="Model" className="space-y-0.5">
                    {REGISTERED_MODELS.map((m) => {
                      const selected =
                        m.id === model ||
                        m.modelId === model ||
                        ((model === "primary" || model === "fallback") && m.isDefaultPrimary);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={isModelLocked}
                          onClick={() => {
                            if (isModelLocked) return;
                            setModel(m.id);
                            try {
                              // Persist the stable wire id so a registry
                              // refactor can never orphan the saved choice.
                              localStorage.setItem(MODEL_STORAGE_KEY, m.modelId);
                            } catch {
                              // ignore
                            }
                            setPickerOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 sm:px-2.5 sm:py-1.5 text-left transition-colors duration-[var(--duration-fast)] ${
                            isModelLocked
                              ? selected
                                ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-text)] cursor-not-allowed"
                                : "text-[var(--color-text-tertiary)] opacity-40 cursor-not-allowed"
                              : selected
                              ? "bg-[var(--color-surface-3)] font-medium text-[var(--color-text)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px] sm:text-[13px] md:text-sm">
                            {m.label}
                          </span>
                          {selected ? (
                            <CheckIcon
                              aria-hidden
                              className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
                            />
                          ) : m.isDefaultPrimary ? (
                            <span className="flex shrink-0 items-center gap-0.5 text-xs text-[var(--color-text-tertiary)]">
                              Default
                              <CaretRightIcon aria-hidden className="h-3 w-3" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                  </>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-[var(--color-border)]/60" />

                  {/* Effort Slider section */}
                  <div className="px-3 pb-3 pt-2">
                    <div className="flex items-center gap-1.5 pb-2 text-xs text-[var(--color-text-secondary)]">
                      <span>Effort</span>
                      <span className="font-semibold text-[var(--color-text)]">
                        {EFFORT_LEVELS.find((e) => e.id === effort)?.label ?? "Medium"}
                      </span>
                    </div>

                    <div className="group/slider">
                    <div
                      role="slider"
                      aria-label="Effort"
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={
                        EFFORT_LEVELS.find((e) => e.id === effort)?.index ?? 1
                      }
                      aria-valuetext={
                        EFFORT_LEVELS.find((e) => e.id === effort)?.label ?? "Medium"
                      }
                      tabIndex={0}
                      onKeyDown={(e) => {
                        const currentIndex =
                          EFFORT_LEVELS.find((lvl) => lvl.id === effort)?.index ?? 1;
                        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault();
                          const prev = EFFORT_LEVELS[Math.max(0, currentIndex - 1)];
                          handleEffortChange(prev.id);
                        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const next = EFFORT_LEVELS[Math.min(2, currentIndex + 1)];
                          handleEffortChange(next.id);
                        }
                      }}
                      className="relative flex h-9 w-full cursor-pointer select-none items-center rounded-xl bg-[var(--color-surface-2)] p-1 border border-[var(--color-border)] transition-[border-color,transform] duration-150 ease-out hover:border-[var(--color-border-strong)] active:scale-[0.99] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus)]"
                    >
                      {/* Filled segment from the left edge up to the knob */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-[var(--color-surface-3)] transition-[width] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
                        style={{
                          width:
                            effort === "low"
                              ? "36px"
                              : effort === "standard"
                              ? "calc(50%)"
                              : "calc(100% - 8px)",
                        }}
                      />

                      {/* Discrete stop notch tick marks */}
                      <span className="pointer-events-none absolute left-[20px] top-1/2 h-2.5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-text-tertiary)]/60" />
                      <span className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-text-tertiary)]/60" />
                      <span className="pointer-events-none absolute right-[20px] top-1/2 h-2.5 w-[2px] translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-text-tertiary)]/60" />

                      {/* Active knob — canvas pill riding the fill edge */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute bottom-1 top-1 w-9 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-canvas)] transition-[left] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-active/slider:scale-[0.97]"
                        style={{
                          left:
                            effort === "low"
                              ? "4px"
                              : effort === "standard"
                              ? "calc(50% - 18px)"
                              : "calc(100% - 40px)",
                          boxShadow: "var(--shadow-control)",
                        }}
                      />

                      {/* Clickable stop targets */}
                      {EFFORT_LEVELS.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          tabIndex={-1}
                          aria-label={`Set effort to ${lvl.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEffortChange(lvl.id);
                          }}
                          className="relative z-10 h-full flex-1 rounded-[var(--radius-md)] bg-transparent focus:outline-none"
                        />
                      ))}
                    </div>
                    </div>
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
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] transition-[transform,opacity] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96]"
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
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
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
