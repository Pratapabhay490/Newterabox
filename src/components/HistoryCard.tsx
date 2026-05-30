"use client";

import Link from "next/link";
import type { HistoryItem } from "@/types";
import {
  formatBytes,
  formatDuration,
  formatRelativeTime,
} from "@/utils/format";

interface Props {
  item: HistoryItem;
  onRemove: () => void;
}

export default function HistoryCard({ item, onRemove }: Props) {
  const progressPct =
    item.durationSec && item.lastPositionSec
      ? Math.min(100, (item.lastPositionSec / item.durationSec) * 100)
      : 0;

  const continueHref = `/?url=${encodeURIComponent(item.sourceUrl)}`;

  return (
    <article className="glass group relative flex h-full flex-col overflow-hidden rounded-2xl transition hover:border-white/20 hover:shadow-glow">
      <Link href={continueHref} className="relative block">
        <div className="aspect-video w-full overflow-hidden bg-ink-800">
          {item.thumbnail ? (
            // Use plain <img> — TeraBox CDN often blocks Next/Image optimisation.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="grid h-full place-items-center text-slate-600">
              <PlayIcon className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-slate-200">
            <span>{formatDuration(item.durationSec)}</span>
            {item.sizeBytes ? <span>{formatBytes(item.sizeBytes)}</span> : null}
          </div>
          {/* Progress bar */}
          {progressPct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3
          className="line-clamp-2 text-sm font-medium text-slate-100"
          title={item.title}
        >
          {item.title}
        </h3>
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="line-clamp-1 text-xs text-slate-400 transition hover:text-brand-300"
          title={item.sourceUrl}
        >
          {item.sourceUrl}
        </a>
        <p className="text-xs text-slate-500">
          Watched {formatRelativeTime(item.lastWatchedAt)}
          {item.lastPositionSec
            ? ` · paused at ${formatDuration(item.lastPositionSec)}`
            : null}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Link
            href={continueHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600 focus-ring"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            {item.lastPositionSec ? "Continue" : "Play"}
          </Link>
          <button
            onClick={onRemove}
            aria-label="Remove from history"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 focus-ring"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
