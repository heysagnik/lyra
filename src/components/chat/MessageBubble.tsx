import { Markdown } from "./Markdown";
import { SourcesRow } from "./SourcesRow";
import { ToolBadge } from "./ToolBadge";
import type { AgentChatMessage } from "@/lib/api/use-agent-chat";

export interface MessageBubbleProps {
  message: AgentChatMessage;
  isLatestStreaming?: boolean;
}

export function MessageBubble({ message, isLatestStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end py-2">
        <div className="max-w-[85%] rounded-[12px] border border-gray-200 bg-[#F9FAFB] px-4 py-2.5 text-sm text-gray-900 break-words">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const hasToolPart = message.parts?.some(
    (p) => p.type === "tool-invocation" || p.toolInvocation
  );

  return (
    <div className="flex w-full justify-start py-3">
      <div className="w-full max-w-full rounded-[12px] bg-white text-sm text-gray-900">
        {hasToolPart && (
          <ToolBadge
            isComplete={!isLatestStreaming}
          />
        )}

        {message.content ? (
          <Markdown content={message.content} />
        ) : isLatestStreaming ? (
          <div className="flex items-center gap-1.5 py-1 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
            <span>Thinking…</span>
          </div>
        ) : null}

        {message.sources && message.sources.length > 0 && (
          <SourcesRow sources={message.sources} />
        )}
      </div>
    </div>
  );
}
