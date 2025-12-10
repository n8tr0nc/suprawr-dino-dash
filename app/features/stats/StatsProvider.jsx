"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useWallet } from "../wallet/useWallet";
import {
  TOKEN_GATING_ENABLED,
  REQUIRED_SUPRAWR_AMOUNT,
} from "../../config/accessConfig";

/* ---------------------------------------------
   Stats Context
--------------------------------------------- */

export const StatsContext = createContext(null);

/* ---------------------------------------------
   Tier calculation (match previous logic)
   - Master:   >= 10,000,000
   - Titan:    >= 1,000,000
   - Guardian: >= 100,000
   - Scaleborn:>= 1,000
   - Hatchling:> 0
--------------------------------------------- */

function computeTierFromSupraWr(balanceDisplay) {
  if (!balanceDisplay) return null;

  const cleanedInt = String(balanceDisplay)
    .split(".")[0]
    .replace(/,/g, "")
    .trim();

  let whole;
  try {
    whole = BigInt(cleanedInt || "0");
  } catch {
    return null;
  }

  if (whole <= 0n) return null;

  if (whole >= 10_000_000n) return "Master";
  if (whole >= 1_000_000n) return "Titan";
  if (whole >= 100_000n) return "Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  return "Hatchling";
}

/* ---------------------------------------------
   Simple JSON fetch helper
--------------------------------------------- */

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Bad response");
    return await res.json();
  } catch (err) {
    console.error("Stats fetch error:", err);
    return null;
  }
}

/* ---------------------------------------------
   StatsProvider
--------------------------------------------- */

export function StatsProvider({ children }) {
  const { connected, address } = useWallet();

  const [supraBalance, setSupraBalance] = useState(null);
  const [supraWrBalance, setSupraWrBalance] = useState(null);
  const [burnTotal, setBurnTotal] = useState(null);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [tier, setTier] = useState(null);
  const [hasAccess, setHasAccess] = useState(true);

  /* ---------------------------------------------
     Broadcast tier updates (compatible with old system)
  --------------------------------------------- */
  const broadcastTierUpdate = useCallback(
    (tierName, supraWrDisplay, supraDisplay, burnDisplay) => {
      if (typeof window === "undefined") return;
      try {
        window.dispatchEvent(
          new CustomEvent("suprawr:tierUpdate", {
            detail: {
              holderRank: tierName,
              balanceDisplay: supraWrDisplay,
              supraBalance: supraDisplay,
              burnDisplay,
            },
          })
        );
      } catch {
        // ignore
      }
    },
    []
  );

  /* ---------------------------------------------
     Manual refresh (and initial load after connect)
  --------------------------------------------- */

  const refresh = useCallback(async () => {
    if (!connected || !address) return;

    const qsAddr = encodeURIComponent(address);

    setLoadingBalances(true);
    setLoadingAccess(true);

    // These endpoints match your existing AccessProvider
    const [supraJson, supraWrJson, burnJson, priceJson] = await Promise.all([
      fetchJson(`/api/supra-balance?address=${qsAddr}`),
      fetchJson(`/api/suprawr-balance?address=${qsAddr}`),
      fetchJson(`/api/burn-total?address=${qsAddr}`),
      fetchJson(`/api/supra-price?t=${Date.now()}`),
    ]);

    // SUPRA balance
    let supraDisplay = null;
    if (
      supraJson &&
      supraJson.ok !== false &&
      typeof supraJson.balanceDisplay === "string"
    ) {
      supraDisplay = supraJson.balanceDisplay;
      setSupraBalance(supraDisplay);
    } else {
      setSupraBalance(null);
    }

    // SUPRA price (USD)
    if (
      priceJson &&
      priceJson.ok !== false &&
      typeof priceJson.priceUsd === "number"
    ) {
      setSupraUsdPrice(priceJson.priceUsd);
    } else {
      setSupraUsdPrice(null);
    }

    // SUPRAWR balance + tier + access
    let supraWrDisplay = null;
    let newTier = null;
    let computedAccess = true;

    if (
      supraWrJson &&
      supraWrJson.ok !== false &&
      typeof supraWrJson.balanceDisplay === "string"
    ) {
      supraWrDisplay = supraWrJson.balanceDisplay;
      setSupraWrBalance(supraWrDisplay);

      newTier = computeTierFromSupraWr(supraWrDisplay);
      setTier(newTier);

      const cleanWr = Number(
        String(supraWrDisplay).replace(/,/g, "")
      );
      const meetsThreshold =
        Number.isFinite(cleanWr) &&
        cleanWr >= REQUIRED_SUPRAWR_AMOUNT;

      computedAccess = TOKEN_GATING_ENABLED ? meetsThreshold : true;
      setHasAccess(computedAccess);
    } else {
      setSupraWrBalance(null);
      setTier(null);
      // If gating is off, still allow access; if on, deny.
      setHasAccess(TOKEN_GATING_ENABLED ? false : true);
    }

    // Burn total
    let burnDisplay = null;
    if (burnJson && burnJson.ok !== false) {
      if (typeof burnJson.burnDisplay === "string") {
        burnDisplay = burnJson.burnDisplay;
      } else if (typeof burnJson.burn_suprawr === "string") {
        burnDisplay = burnJson.burn_suprawr;
      } else if (typeof burnJson.burnSupraWr === "string") {
        burnDisplay = burnJson.burnSupraWr;
      }
    }
    setBurnTotal(burnDisplay);

    // Broadcast with full context
    broadcastTierUpdate(newTier, supraWrDisplay, supraDisplay, burnDisplay);

    setLoadingBalances(false);
    setLoadingAccess(false);
  }, [connected, address, broadcastTierUpdate]);

  /* ---------------------------------------------
     Load stats ONLY when wallet connects
  --------------------------------------------- */

  useEffect(() => {
    if (!connected || !address) {
      // Reset stats when disconnected
      setSupraBalance(null);
      setSupraWrBalance(null);
      setBurnTotal(null);
      setSupraUsdPrice(null);
      setTier(null);
      setHasAccess(true); // default allow when no wallet
      return;
    }

    // Wallet connected → fetch stats once
    refresh();
  }, [connected, address, refresh]);

  /* ---------------------------------------------
     Context value
  --------------------------------------------- */

  const value = useMemo(
    () => ({
      supraBalance,
      supraWrBalance,
      burnTotal,
      supraUsdPrice,

      tier,
      hasAccess,

      loadingBalances,
      loadingAccess,

      refresh,
    }),
    [
      supraBalance,
      supraWrBalance,
      burnTotal,
      supraUsdPrice,
      tier,
      hasAccess,
      loadingBalances,
      loadingAccess,
      refresh,
    ]
  );

  return (
    <StatsContext.Provider value={value}>
      {children}
    </StatsContext.Provider>
  );
}
