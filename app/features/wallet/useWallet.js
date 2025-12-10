"use client";

import { useContext } from "react";
import { WalletContext } from "./WalletProvider";

/**
 * useWallet()
 * Exposes wallet-only state:
 *  - providerReady
 *  - provider
 *  - connected
 *  - address
 *  - connect()
 *  - disconnect()
 *
 * No stats, no tiers, no gating logic here.
 */
export function useWallet() {
  return useContext(WalletContext);
}
