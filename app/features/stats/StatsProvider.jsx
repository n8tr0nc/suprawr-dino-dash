"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import {
  TOKEN_GATING_ENABLED,
  REQUIRED_SUPRAWR_AMOUNT,
} from "@/config/accessConfig";

import { useWallet } from "@/app/features/wallet/useWallet";

export const StatsContext = createContext(null);

export function StatsProvider({ children }) {
  const { connected, address } = useWallet();

  // ------------ STATE ------------
  const [supraBalance, setSupraBalance] = useState(null);
  const [supraWrBalance, setSupraWrBalance] = useState(null);
  const [burnTotal, setBurnTotal] = useState(null);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  const [accessTier, setAccessTier] = useState(null);
  const [hasAccess, setHasAccess] = useState(true); // ungated unless enabled

  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [error, setError] = useState(null);

  const lastFetchRef = useRef(0);
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache, but only on manual refresh


  // ------------ TIER LOGIC ------------
  function computeTier(balanceDisplay) {
    if (!balanceDisplay) return null;

    const cleaned = String(balanceDisplay).split(".")[0].replace(/,/g, "");
    let whole;

    try {
      whole = BigInt(cleaned);
    } catch {
      return null;
    }

    if (whole >= 10_000_000n) return "Master";
    if (whole >= 1_000_000n) return "Titan";
    if (whole >= 100_000n) return "Guardian";
    if (whole >= 1_000n) return "Scaleborn";
    if (whole > 0n) return "Hatchling";
    return null;
  }


  // ------------ FETCH HELPERS ------------

  const fetchSupra = useCallback(async (addr) => {
    const res = await fetch(`/api/supra-balance?address=${addr}`);
    if (!res.ok) return null;

    const json = await res.json();
    return json?.balanceDisplay || null;
  }, []);

  const fetchSupraWR = useCallback(async (addr) => {
    const res = await fetch(`/api/suprawr-balance?address=${addr}`);
    if (!res.ok) return { display: null, meets: false };

    const json = await res.json();
    return {
      display: json?.balanceDisplay || null,
      meets: json?.meetsRequirement || false,
    };
  }, []);

  const fetchBurnTotal = useCallback(async (addr) => {
    const res = await fetch(`/api/burn-total?address=${addr}`);
    if (!res.ok) return null;

    const json = await res.json();
    return json?.burn_suprawr || null;
  }, []);

  const fetchSupraPrice = useCallback(async () => {
    const res = await fetch(`/api/supra-price`);
    if (!res.ok) return null;

    const json = await res.json();
    return json?.priceUsd || null;
  }, []);


  // ------------ MAIN REFRESH METHOD ------------
  const refresh = useCallback(
    async (opts = { force: false }) => {
      if (!connected || !address) return;

      const now = Date.now();
      if (!opts.force && now - lastFetchRef.current < CACHE_TTL) {
        return; // prevent unnecessary spam
      }

      lastFetchRef.current = now;
      setLoadingBalances(true);
      setLoadingAccess(true);
      setError(null);

      try {
        // SUPRA balance
        const supra = await fetchSupra(address);
        setSupraBalance(supra);

        // SUPRAWR balance + requirement
        const wr = await fetchSupraWR(address);
        setSupraWrBalance(wr.display);

        // Burn total
        const burn = await fetchBurnTotal(address);
        setBurnTotal(burn);

        // SUPRA price
        const price = await fetchSupraPrice();
        setSupraUsdPrice(price);

        // Tier calculation
        const tier = computeTier(wr.display);
        setAccessTier(tier);

        // Token gate logic
        if (TOKEN_GATING_ENABLED) {
          const cleanWr = Number(String(wr.display).replace(/,/g, ""));
          const meets = cleanWr >= REQUIRED_SUPRAWR_AMOUNT;
          setHasAccess(meets);
        } else {
          setHasAccess(true);
        }

      } catch (err) {
        console.error("Stats refresh error:", err);
        setError("Failed to refresh wallet stats.");
      } finally {
        setLoadingBalances(false);
        setLoadingAccess(false);
      }
    },
    [
      connected,
      address,
      fetchSupra,
      fetchSupraWR,
      fetchBurnTotal,
      fetchSupraPrice,
    ]
  );


  // ------------ AUTO-REFRESH ON CONNECT ------------
  useEffect(() => {
    if (connected && address) {
      refresh({ force: true });
    } else {
      // reset on disconnect
      setSupraBalance(null);
      setSupraWrBalance(null);
      setBurnTotal(null);
      setSupraUsdPrice(null);
      setAccessTier(null);
      setHasAccess(true);
      setError(null);
    }
  }, [connected, address, refresh]);


  const value = {
    // balances & stats
    supraBalance,
    supraWrBalance,
    burnTotal,
    supraUsdPrice,

    // tier
    accessTier,

    // access control
    hasAccess,

    // loading flags
    loadingBalances,
    loadingAccess,

    // errors
    error,

    // manual refresh
    refresh,
  };

  return (
    <StatsContext.Provider value={value}>
      {children}
    </StatsContext.Provider>
  );
}
