import { Loader2, Check, Globe } from "lucide-react";

export interface ToolBadgeProps {
  query?: string;
  isComplete?: boolean;
}

export function ToolBadge({ query, isComplete = false }: ToolBadgeProps) {
  return (
    <div className="my-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
      <Globe className="h-3.5 w-3.5 text-blue-600" />
      <span>
        {isComplete ? "Searched the web" : "Searching the web"}
        {query ? `: "${query}"` : "…"}
      </span>
      {isComplete ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
      )}
    </div>
  );
}
