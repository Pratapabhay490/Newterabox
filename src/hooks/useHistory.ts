"use client";

import { useCallback, useEffect, useState } from "react";
import { localHistoryStore } from "@/services/history";
import type { HistoryItem } from "@/types";

/**
 * React hook around the localHistoryStore.
 *
 * Subscribes to the 'terabooks:history-updated' CustomEvent so multiple
 * components stay in sync. Also updates on cross-tab `storage` events.
 */
export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  const refresh = useCallback(() => {
    setItems(localHistoryStore.list());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("terabooks:")) refresh();
    };
    window.addEventListener("terabooks:history-updated", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("terabooks:history-updated", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return {
    items,
    remove: (id: string) => localHistoryStore.remove(id),
    clear: () => localHistoryStore.clear(),
    refresh,
  };
}
