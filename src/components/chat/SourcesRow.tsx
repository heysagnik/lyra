import { ExternalLink } from "lucide-react";
import type { SearchSource } from "@/types";

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

/**
 * Catalogued source entries — every citation is a charted object with a
 * Numbered citation chips with their origin hostname.
 */
export function SourcesRow({ sources }: SourcesRowProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--line-soft)] pt-2.5">
      <p className="mb-2 text-[11px] text-[var(--text-faint)]">Sources</p>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => {
          const hostname = getHostname(source.url);
          return (
            <li key={source.url + index}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={source.snippet || source.title}
                className="inline-flex max-w-full items-center gap-1.5 rounded border border-[var(--line-soft)] bg-[var(--panel-2)] px-2 py-1 text-xs text-[var(--text-muted)] transition-[border-color,color,background-color] duration-[var(--duration-normal)] hover:border-[var(--accent)]/50 hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
              >
                <span className="text-[var(--text-faint)] tabular-nums">
                  [{index + 1}]
                </span>
                <span className="max-w-[150px] truncate">
                  {source.title || hostname}
                </span>
                <span className="font-coordinate text-[10px] text-[var(--text-faint)]">
                  {hostname}
                </span>
                <ExternalLink aria-hidden className="h-3 w-3 opacity-50" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
