/**
 * History store — persists watch history.
 *
 * Front-end only consumes the `HistoryStore` interface, so swapping
 * localStorage for a real database later requires no UI changes.
 */

import type { ExtractedVideo, HistoryItem } from "@/types";

export interface HistoryStore {
  list(): HistoryItem[];
  get(id: string): HistoryItem | undefined;
  upsert(video: ExtractedVideo, positionSec?: number): HistoryItem;
  updateProgress(id: string, positionSec: number): void;
  remove(id: string): void;
  clear(): void;
}

const STORAGE_KEY = "terabooks:history:v1";
const MAX_ITEMS = 200;

function read(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_ITEMS)),
    );
    // Notify other tabs / hooks listening for updates.
    window.dispatchEvent(new CustomEvent("terabooks:history-updated"));
  } catch {
    // Ignore quota errors silently.
  }
}

export const localHistoryStore: HistoryStore = {
  list() {
    return read().sort(
      (a, b) =>
        new Date(b.lastWatchedAt).getTime() -
        new Date(a.lastWatchedAt).getTime(),
    );
  },

  get(id) {
    return read().find((it) => it.id === id);
  },

  upsert(video, positionSec = 0) {
    const items = read();
    const idx = items.findIndex((it) => it.id === video.id);
    const now = new Date().toISOString();
    const merged: HistoryItem = {
      ...(idx >= 0 ? items[idx] : {}),
      ...video,
      lastPositionSec:
        idx >= 0 ? items[idx].lastPositionSec || positionSec : positionSec,
      lastWatchedAt: now,
    };
    if (idx >= 0) items[idx] = merged;
    else items.unshift(merged);
    write(items);
    return merged;
  },

  updateProgress(id, positionSec) {
    const items = read();
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    items[idx] = {
      ...items[idx],
      lastPositionSec: positionSec,
      lastWatchedAt: new Date().toISOString(),
    };
    write(items);
  },

  remove(id) {
    write(read().filter((it) => it.id !== id));
  },

  clear() {
    write([]);
  },
};
