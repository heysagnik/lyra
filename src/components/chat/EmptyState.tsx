import { Compass, Globe, Sparkles, Code2 } from "lucide-react";

export interface EmptyStateProps {
  onSelectPrompt: (prompt: string, search?: boolean) => void;
}

const SUGGESTIONS = [
  {
    icon: Globe,
    title: "Search current news",
    prompt: "What are the latest AI hardware announcements this week?",
    search: true,
  },
  {
    icon: Code2,
    title: "Explain a concept",
    prompt: "How does Postgres streaming replication work under the hood?",
    search: false,
  },
  {
    icon: Sparkles,
    title: "Draft TypeScript code",
    prompt: "Write a strict generic Result<T, E> type with map and flatMap helpers.",
    search: false,
  },
  {
    icon: Compass,
    title: "Compare architectures",
    prompt: "What are the latency tradeoffs between WebSockets and HTTP SSE for AI chat?",
    search: false,
  },
];

export function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Sparkles className="h-6 w-6" />
      </div>

      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        How can I help you today?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        I am Aria, your chat assistant with live web search and persistent memory.
      </p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
        {SUGGESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={() => onSelectPrompt(item.prompt, item.search)}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3.5 transition-all hover:border-blue-400 hover:bg-gray-50 text-left"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <div className="text-xs font-medium text-gray-900">
                  {item.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                  {item.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
