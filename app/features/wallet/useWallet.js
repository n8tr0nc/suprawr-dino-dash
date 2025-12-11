"use client";

import { useContext } from "react";
import { WalletContext } from "./WalletProvider";

export function useWallet() {
  const ctx = useContext(WalletContext);

  // Keep fallback but expose stable shape
  if (!ctx) {
    return {
      providerReady: false,
      walletInstalled: false,
      connected: false,
      address: null,
      connect: async () => {},
      disconnect: async () => {},
    };
  }

  return ctx;
}
