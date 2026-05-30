"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import SearchBar from "@/components/SearchBar";
import ErrorMessage from "@/components/ErrorMessage";
import PlayerSkeleton from "@/components/Skeleton";
import { localHistoryStore } from "@/services/history";
import type { ApiError, ExtractedVideo } from "@/types";

// Lazy-load the player so Plyr/hls.js never ship to the initial route bundle.
const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
  loading: () => <PlayerSkeleton />,
});

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; video: ExtractedVideo; resumeAt: number }
  | { kind: "error"; message: string; code?: ApiError["code"] };

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const onSubmit = useCallback(async (url: string) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as ExtractedVideo | ApiError;
      if (!res.ok || "error" in data) {
        const err = data as ApiError;
        setState({
          kind: "error",
          message: err.error || "Could not extract this video.",
          code: err.code,
        });
        return;
      }
      // Persist to history; pick up any prior resume position.
      const existing = localHistoryStore.get(data.id);
      const item = localHistoryStore.upsert(
        data,
        existing?.lastPositionSec || 0,
      );
      setState({
        kind: "ready",
        video: data,
        resumeAt: item.lastPositionSec || 0,
      });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Network error — please retry.",
      });
    }
  }, []);

  // If we landed here with ?url=... (e.g. from "Continue watching"), auto-extract.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (url) onSubmit(url);
  }, [onSubmit]);

  return (
    <div className="space-y-10">
      {/* Hero / search */}
      <section className="pt-8 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h1 className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Stream any public TeraBox link
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-sm text-slate-400 sm:text-base">
            Paste the share URL and we&apos;ll resolve a direct stream into a
            clean OTT-style player — with quality, speed, picture-in-picture,
            and resume baked in.
          </p>
        </motion.div>

        <div className="mx-auto mt-8 max-w-3xl">
          <SearchBar
            onSubmit={onSubmit}
            disabled={state.kind === "loading"}
          />
        </div>
      </section>

      {/* Player area */}
      <section className="min-h-[200px]">
        <AnimatePresence mode="wait">
          {state.kind === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PlayerSkeleton />
              <p className="mt-4 text-center text-sm text-slate-400">
                Extracting stream… this can take a few seconds.
              </p>
            </motion.div>
          )}

          {state.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <ErrorMessage message={state.message} code={state.code} />
            </motion.div>
          )}

          {state.kind === "ready" && (
            <motion.div
              key={state.video.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              <VideoPlayer video={state.video} resumeAt={state.resumeAt} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
