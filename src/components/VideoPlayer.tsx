"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Plyr from "plyr";
import Hls from "hls.js";
import type { ExtractedVideo } from "@/types";
import { usePlaybackProgress } from "@/hooks/usePlaybackProgress";
import { formatBytes, formatDuration } from "@/utils/format";

interface Props {
  video: ExtractedVideo;
  /** Resume playback from this many seconds. */
  resumeAt?: number;
}

/**
 * Pipe the extracted directUrl through our /api/stream proxy so:
 *  - the browser bypasses CORS,
 *  - we can attach the right Referer/User-Agent for TeraBox CDNs.
 */
function proxied(url: string): string {
  return `/api/stream?u=${encodeURIComponent(url)}`;
}

export default function VideoPlayer({ video, resumeAt = 0 }: Props) {
  // useState (not useRef) so the progress hook re-runs once the <video>
  // element actually mounts.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [activeQuality, setActiveQuality] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeUrl = useMemo(
    () => video.qualities[activeQuality]?.url || video.directUrl,
    [video, activeQuality],
  );

  // Track the <video> element for the progress hook.
  usePlaybackProgress(videoEl, video.id);

  // ── Initialise / re-initialise the player ──────────────────────────────
  useEffect(() => {
    const el = videoEl;
    if (!el) return;

    // Tear down any previous instance.
    hlsRef.current?.destroy();
    hlsRef.current = null;
    playerRef.current?.destroy();
    playerRef.current = null;

    const proxiedUrl = proxied(activeUrl);
    const isHls = /\.m3u8(\?|$)/i.test(activeUrl);

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(proxiedUrl);
      hls.attachMedia(el);
      hlsRef.current = hls;
    } else {
      el.src = proxiedUrl;
    }

    const player = new Plyr(el, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      settings: ["quality", "speed"],
      speed: { selected: 1, options: [0.5, 1, 1.5, 1.8, 2] },
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      ratio: "16:9",
    });
    playerRef.current = player;

    // Resume from saved position once metadata is available.
    const onLoaded = () => {
      if (resumeAt && resumeAt > 1 && resumeAt < (el.duration || Infinity)) {
        try {
          el.currentTime = resumeAt;
        } catch {
          /* some browsers throw if not seekable yet */
        }
      }
    };
    el.addEventListener("loadedmetadata", onLoaded, { once: true });

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // We intentionally re-init only when the source or element changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl, videoEl]);

  const onCopyStream = async () => {
    try {
      // Copy the *original* direct URL — useful for debugging.
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const hasMultipleQualities = video.qualities.length > 1;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-black shadow-glass ring-1 ring-white/5">
        <video
          ref={setVideoEl}
          playsInline
          controls
          poster={video.thumbnail}
          crossOrigin="anonymous"
          preload="metadata"
        />
      </div>

      <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-slate-100">
            {video.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDuration(video.durationSec)}
            {video.sizeBytes ? ` · ${formatBytes(video.sizeBytes)}` : ""}
            {hasMultipleQualities
              ? ` · ${video.qualities.length} qualities`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasMultipleQualities && (
            <select
              value={activeQuality}
              onChange={(e) => setActiveQuality(Number(e.target.value))}
              aria-label="Quality"
              className="glass-strong focus-ring rounded-lg px-3 py-1.5 text-xs text-slate-200"
            >
              {video.qualities.map((q, i) => (
                <option key={q.label + i} value={i} className="bg-ink-800">
                  {q.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onCopyStream}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 focus-ring"
            aria-label="Copy direct stream URL"
          >
            {copied ? "Copied!" : "Copy Stream URL"}
          </button>
          <a
            href={video.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 focus-ring"
          >
            Original link
          </a>
        </div>
      </div>
    </div>
  );
}
