"use client";

import type { QueryClient } from "@tanstack/react-query";

const CHANNEL_NAME = "applyflow-sync";

type SyncMessage = {
  type: "invalidate";
  keys: string[][];
};

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

// Call after any mutation to notify all other tabs which query keys changed.
export function broadcastInvalidate(...keys: string[][]): void {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage({ type: "invalidate", keys } satisfies SyncMessage);
  ch.close();
}

// Call once in the root layout. Returns a cleanup function.
export function setupSyncListener(queryClient: QueryClient): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  function handler(event: MessageEvent<SyncMessage>) {
    if (event.data?.type === "invalidate" && Array.isArray(event.data.keys)) {
      for (const key of event.data.keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }

  ch.addEventListener("message", handler);
  return () => {
    ch.removeEventListener("message", handler);
    ch.close();
  };
}
