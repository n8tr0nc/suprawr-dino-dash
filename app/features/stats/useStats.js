"use client";

import { useAccess } from "../access/useAccess";

/**
 * Stats / access-focused hook over the existing AccessProvider.
 * All logic still lives in AccessProvider; this just shapes it.
 */
export function useStats() {
  const ctx = useAccess();

  if (!ctx) {
    throw new Error("useStats must be used within <AccessProvider>.");
  }

  const {
    // balances / totals
    supraBalance,
    supraWrBalance,
    burnTotal,
    // pricing
    supraUsdPrice,
    // access gate
    accessTier,
    hasAccess,
    loadingBalances,
    loadingAccess,
    error,
    // manual refresh function original value.refresh
    refresh,
  } = ctx;

  return {
    supraBalance,
    supraWrBalance,
    burnTotal,
    supraUsdPrice,
    accessTier,
    hasAccess,
    loadingBalances,
    loadingAccess,
    error,
    refresh,
  };
}
