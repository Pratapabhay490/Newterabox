"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import HistoryCard from "@/components/HistoryCard";
import { useHistory } from "@/hooks/useHistory";
import { MOCK_HISTORY } from "@/utils/mockData";
import { localHistoryStore } from "@/services/history";

export default function HistoryPage() {
  const { items, remove, clear } = useHistory();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.sourceUrl.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="space-y-8 pt-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Watch history
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Stored locally in this browser. Clear anytime.
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or URL…"
            className="glass focus-ring w-full rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 sm:w-72"
          />
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all history?")) clear();
              }}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20 focus-ring"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.ul
          layout
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence>
            {filtered.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <HistoryCard item={item} onRemove={() => remove(item.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-slate-500">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          )}
        </motion.ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass mx-auto max-w-2xl rounded-2xl px-6 py-12 text-center">
      <h2 className="text-lg font-medium text-slate-200">No history yet</h2>
      <p className="mt-2 text-sm text-slate-400">
        Videos you play will show up here automatically.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 focus-ring"
        >
          Play your first video
        </Link>
        <button
          onClick={() => {
            // Inject mock data so reviewers can see the layout filled in.
            for (const item of MOCK_HISTORY) {
              localHistoryStore.upsert(item, item.lastPositionSec);
            }
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 focus-ring"
        >
          Load sample data
        </button>
      </div>
    </div>
  );
}
