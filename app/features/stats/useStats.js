"use client";

import { useContext } from "react";
import { StatsContext } from "./StatsProvider";

/**
 * useStats()
 * Exposes ONLY:
 *  - supraBalance
 *  - supraWrBalance
 *  - burnTotal
 *  - supraUsdPrice
 *  - accessTier
 *  - hasAccess
 *  - loadingBalances, loadingAccess
 *  - error
 *  - refresh()
 */
export function useStats() {
  return useContext(StatsContext);
}
