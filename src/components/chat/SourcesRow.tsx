import type { SearchSource } from "@/types";
import { ExternalLink } from "lucide-react";

export interface SourcesRowProps {
  sources: SearchSource[];
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function SourcesRow({ sources }: SourcesRowProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 text-xs">
      <span className="font-medium text-gray-500">Sources:</span>
      {sources.map((source, index) => {
        const hostname = getHostname(source.url);
        return (
          <a
            key={source.url + index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.snippet || source.title}
            className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="font-semibold text-gray-500">[{index + 1}]</span>
            <span className="max-w-[140px] truncate">{source.title || hostname}</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        );
      })}
    </div>
  );
}
