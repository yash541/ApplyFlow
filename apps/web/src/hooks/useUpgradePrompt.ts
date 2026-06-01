"use client";

import { create } from "zustand";

interface UpgradePromptState {
  showUpgrade: boolean;
  upgradeReason: string;
  openUpgrade: (reason?: string) => void;
  closeUpgrade: () => void;
}

export const useUpgradePrompt = create<UpgradePromptState>()((set) => ({
  showUpgrade: false,
  upgradeReason: "",
  openUpgrade: (reason = "") => set({ showUpgrade: true, upgradeReason: reason }),
  closeUpgrade: () => set({ showUpgrade: false, upgradeReason: "" }),
}));
