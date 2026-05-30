"use client";

import { useState, useCallback, FormEvent } from "react";
import { isTeraBoxUrl } from "@/utils/url";

interface Props {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export default function SearchBar({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  // Soft check only — we never block submission. The server is the source
  // of truth for whether a URL is actually extractable, since TeraBox uses
  // many mirror domains we can't fully enumerate on the client.
  const trimmed = value.trim();
  const looksValid = trimmed.length === 0 || isTeraBoxUrl(trimmed);
  const showWarning = touched && trimmed.length > 0 && !looksValid;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setTouched(true);
      const url = value.trim();
      if (!url) return;
      onSubmit(url);
    },
    [value, onSubmit],
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
    } catch {
      // permission denied — silently ignore
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div
        className={[
          "glass-strong group relative flex items-center gap-2 rounded-2xl px-3 py-2 shadow-glass transition",
          showWarning ? "ring-2 ring-amber-400/50" : "focus-within:shadow-glow",
        ].join(" ")}
      >
        <LinkIcon className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Paste a public TeraBox link…"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          className="flex-1 bg-transparent px-1 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none sm:text-base"
        />
        <button
          type="button"
          onClick={pasteFromClipboard}
          disabled={disabled}
          className="hidden rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 sm:inline-block"
        >
          Paste
        </button>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/40 disabled:shadow-none focus-ring"
        >
          {disabled ? (
            <Spinner />
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Play Video
            </>
          )}
        </button>
      </div>

      {showWarning && (
        <p className="px-2 text-xs text-amber-300/90">
          This doesn&apos;t look like a typical TeraBox link, but we&apos;ll
          still try.
        </p>
      )}
    </form>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin text-white"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity=".25"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
