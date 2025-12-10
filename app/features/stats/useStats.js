"use client";

import { useContext } from "react";
import { StatsContext } from "./StatsProvider";

export function useStats() {
  const ctx = useContext(StatsContext);

  // Safety fallback so destructuring never blows up
  if (!ctx) {
    return {
      supraBalance: null,
      supraWrBalance: null,
      burnTotal: null,
      supraUsdPrice: null,
      accessTier: null,
      hasAccess: null,
      loadingBalances: false,
      loadingAccess: false,
      error: null,
      refresh: () => {},
    };
  }

  return ctx;
}
