"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWallet } from "../wallet/useWallet";
import {
  TOKEN_GATING_ENABLED,
  REQUIRED_SUPRAWR_AMOUNT,
} from "../../../config/accessConfig";

export const StatsContext = createContext(null);

// Reuse the same TTL you had before (1 hour)
const BALANCE_CACHE_TTL = 3_600_000; // 60 minutes

// Tier logic copied from your previous AccessProvider
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

// Optional legacy event for anything listening on window
function broadcastTierUpdate(tier, supraWrDisplay, supraDisplay, burnDisplay) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("suprawr:tierUpdate", {
        detail: {
          holderRank: tier,
          balanceDisplay: supraWrDisplay,
          supraBalance: supraDisplay,
          burnDisplay,
        },
      })
    );
  } catch {
    // non-critical
  }
}

export function StatsProvider({ children }) {
  const { connected, address } = useWallet();

  const [supraBalance, setSupraBalance] = useState(null);
  const [supraWrBalance, setSupraWrBalance] = useState(null);
  const [burnTotal, setBurnTotal] = useState(null);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  const [accessTier, setAccessTier] = useState(null);
  const [hasAccess, setHasAccess] = useState(null);

  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [error, setError] = useState(null);

  const lastBalanceFetchRef = useRef(0);

  // Core fetcher used by both auto-load and manual refresh
  const fetchAllBalances = useCallback(
    async (addr, options = {}) => {
      if (!addr) return;

      const {
        force = false,
        includeAccessCheck = TOKEN_GATING_ENABLED,
      } = options;

      const now = Date.now();
      if (!force && now - lastBalanceFetchRef.current < BALANCE_CACHE_TTL) {
        return;
      }
      lastBalanceFetchRef.current = now;

      setLoadingBalances(true);
      if (includeAccessCheck) setLoadingAccess(true);
      setError(null);

      try {
        const qsAddr = encodeURIComponent(addr);

        const [supraRes, supraWrRes, burnRes, priceRes] = await Promise.all([
          fetch(`/api/supra-balance?address=${qsAddr}`),
          fetch(`/api/suprawr-balance?address=${qsAddr}`),
          fetch(`/api/burn-total?address=${qsAddr}`),
          fetch(`/api/supra-price?t=${Date.now()}`),
        ]);

        const supraJson = supraRes.ok ? await supraRes.json() : null;
        const supraWrJson = supraWrRes.ok ? await supraWrRes.json() : null;
        const burnJson = burnRes.ok ? await burnRes.json() : null;
        const priceJson = priceRes.ok ? await priceRes.json() : null;

        // SUPRA balance
        let supraDisplay = null;
        if (
          supraJson &&
          supraJson.ok !== false &&
          typeof supraJson.balanceDisplay === "string"
        ) {
          supraDisplay = supraJson.balanceDisplay;
        }
        setSupraBalance(supraDisplay);

        // USD price for SUPRA  **(fixed to match /api/supra-price)**
        let nextUsdPrice = null;
        if (priceJson && priceJson.ok !== false) {
          if (typeof priceJson.priceUsd === "number") {
            // current API field
            nextUsdPrice = priceJson.priceUsd;
          } else if (typeof priceJson.usd === "number") {
            // fallback, in case you ever change the route
            nextUsdPrice = priceJson.usd;
          }
        }
        setSupraUsdPrice(nextUsdPrice);

        // SUPRAWR balance + tier + gate
        let tier = null;
        let supraWrDisplay = null;
        let access = null;

        if (
          supraWrJson &&
          supraWrJson.ok !== false &&
          typeof supraWrJson.balanceDisplay === "string"
        ) {
          supraWrDisplay = supraWrJson.balanceDisplay;
          setSupraWrBalance(supraWrDisplay);

          tier = computeTierFromSupraWr(supraWrDisplay);
          setAccessTier(tier);

          // Gating logic (using config)
          const clean = Number(
            String(supraWrDisplay).replace(/,/g, "").split(".")[0]
          );
          const meets =
            Number.isFinite(clean) && clean >= REQUIRED_SUPRAWR_AMOUNT;

          if (includeAccessCheck) {
            access = TOKEN_GATING_ENABLED ? meets : true;
            setHasAccess(access);
          } else if (!TOKEN_GATING_ENABLED) {
            setHasAccess(true);
          }
        } else {
          setSupraWrBalance(null);
          setAccessTier(null);
          if (includeAccessCheck) {
            setHasAccess(TOKEN_GATING_ENABLED ? false : true);
          }
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

        if (includeAccessCheck) {
          broadcastTierUpdate(
            tier,
            supraWrDisplay,
            supraDisplay,
            burnDisplay
          );
        }
      } catch (err) {
        console.error("[StatsProvider] balance fetch error:", err);
        setError("Failed to refresh wallet stats.");
        setSupraBalance(null);
        setSupraWrBalance(null);
        setBurnTotal(null);
        setSupraUsdPrice(null);
        setAccessTier(null);
        if (TOKEN_GATING_ENABLED) {
          setHasAccess(null);
        } else {
          setHasAccess(true); // no gating, but stats failed
        }
      } finally {
        setLoadingBalances(false);
        setLoadingAccess(false);
      }
    },
    []
  );

  // Exposed manual refresh (used by sidebar button)
  const refresh = useCallback(() => {
    if (!connected || !address) return;
    return fetchAllBalances(address, {
      force: true,
      includeAccessCheck: TOKEN_GATING_ENABLED,
    });
  }, [connected, address, fetchAllBalances]);

  // Auto-load when wallet connects / address changes
  useEffect(() => {
    if (!connected || !address) {
      setSupraBalance(null);
      setSupraWrBalance(null);
      setBurnTotal(null);
      setSupraUsdPrice(null);
      setAccessTier(null);
      setHasAccess(null);
      setLoadingBalances(false);
      setLoadingAccess(false);
      setError(null);
      return;
    }

    fetchAllBalances(address, {
      force: true,
      includeAccessCheck: TOKEN_GATING_ENABLED,
    });
  }, [connected, address, fetchAllBalances]);

  const value = {
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

  return (
    <StatsContext.Provider value={value}>{children}</StatsContext.Provider>
  );
}
