"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Globe, Square } from "lucide-react";

export interface ComposerProps {
  onSend: (text: string, search: boolean) => void;
  isStreaming: boolean;
  onStop: () => void;
  searchDefault?: boolean;
  retryAfterSeconds?: number;
}

export function Composer({
  onSend,
  isStreaming,
  onStop,
  searchDefault = true,
  retryAfterSeconds,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(searchDefault);
  const [countdown, setCountdown] = useState<number | undefined>(retryAfterSeconds);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync search state if default changes
  useEffect(() => {
    setSearchEnabled(searchDefault);
  }, [searchDefault]);

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
        200
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
    if (!text.trim() || countdown !== undefined) return;
    onSend(text.trim(), searchEnabled);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-gray-400">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={countdown !== undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            countdown
              ? `Rate limit reached. Please wait ${countdown}s...`
              : "Ask Aria anything…"
          }
          className="w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-12 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        />

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
          {/* Search Toggle Pill */}
          <button
            type="button"
            onClick={() => setSearchEnabled(!searchEnabled)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              searchEnabled
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Search</span>
          </button>

          {/* Send / Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white transition-opacity hover:opacity-90"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || countdown !== undefined}
              aria-label="Send message"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-opacity hover:bg-blue-700 disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-center text-[11px] text-gray-400">
        Aria can make mistakes. Verify important factual information.
      </div>
    </div>
  );
}
