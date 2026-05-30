"use client";

import { useEffect, useRef } from "react";
import { localHistoryStore } from "@/services/history";

/**
 * Persists the current playback time to history every `intervalMs`
 * while the video is playing. Also flushes on pause / unmount /
 * page hide so we never lose the last position.
 */
export function usePlaybackProgress(
  videoEl: HTMLVideoElement | null,
  videoId: string,
  intervalMs = 5000,
) {
  const lastSavedRef = useRef(0);

  useEffect(() => {
    if (!videoEl || !videoId) return;

    const save = () => {
      const t = videoEl.currentTime;
      if (!Number.isFinite(t) || t < 1) return;
      // Avoid spamming localStorage with tiny deltas.
      if (Math.abs(t - lastSavedRef.current) < 2) return;
      lastSavedRef.current = t;
      localHistoryStore.updateProgress(videoId, Math.floor(t));
    };

    const interval = window.setInterval(() => {
      if (!videoEl.paused && !videoEl.ended) save();
    }, intervalMs);

    const onPause = () => save();
    const onEnded = () => save();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };

    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", save);

    return () => {
      window.clearInterval(interval);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, [videoEl, videoId, intervalMs]);
}
