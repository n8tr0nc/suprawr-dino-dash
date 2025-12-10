"use client";

import { useContext } from "react";
import { WalletContext } from "./WalletProvider";

export function useWallet() {
  const ctx = useContext(WalletContext);

  // Safety fallback so destructuring never explodes, even if somehow
  // used outside the provider.
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
