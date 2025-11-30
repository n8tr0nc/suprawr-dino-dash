"use client";

import React, { useEffect, useState } from "react";

// Shared RPC base URL (still used by GasFeeStats for gas history)
export const RPC_BASE_URL = "https://rpc-mainnet.supra.com";

// SUPRAWR token + requirement
export const SUPRAWR_TOKEN_ADDRESS =
  "0x82ed1f483b5fc4ad105cef5330e480136d58156c30dc70cd2b9c342981997cee";

// 1,000 whole SUPRAWR
export const REQUIRED_SUPRAWR_WHOLE = 1_000n;

/**
 * Frontend helper:
 * Calls our own API route (/api/suprawr-balance) which queries Supra RPC / Atmos Pump
 * on the server.
 *
 * Always returns { hasAccess, balanceDisplay, balanceRaw } and NEVER throws.
 */
export async function fetchSupraWrAccess(address) {
  if (!address) {
    return {
      hasAccess: false,
      balanceDisplay: "0.000000",
      balanceRaw: "0",
    };
  }

  try {
    const url = `/api/suprawr-balance?address=${encodeURIComponent(address)}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("suprawr-balance API non-OK:", res.status);
      return {
        hasAccess: false,
        balanceDisplay: "0.000000",
        balanceRaw: "0",
      };
    }

    const data = await res.json();

    if (!data || data.ok === false) {
      console.warn("suprawr-balance API error payload:", data);
      return {
        hasAccess: false,
        balanceDisplay: "0.000000",
        balanceRaw: "0",
      };
    }

    return {
      hasAccess: !!data.meetsRequirement,
      balanceDisplay: data.balanceDisplay || "0.000000",
      balanceRaw: data.balanceRaw || "0",
    };
  } catch (err) {
    console.error("fetchSupraWrAccess failed:", err);
    return {
      hasAccess: false,
      balanceDisplay: "0.000000",
      balanceRaw: "0",
    };
  }
}

/**
 * Optional reusable component if you want to gate *other* modules later.
 * Not currently used by GasFeeStats, but kept ready.
 */
export default function TokenGate({
  address,
  children,
  fallback = null,
  requiredWhole = REQUIRED_SUPRAWR_WHOLE,
}) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [balanceDisplay, setBalanceDisplay] = useState("0.000000");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!address) {
        setAllowed(false);
        setBalanceDisplay("0.000000");
        setLoading(false);
        return;
      }

      setLoading(true);
      const res = await fetchSupraWrAccess(address);
      if (cancelled) return;

      setAllowed(!!res.hasAccess);
      setBalanceDisplay(res.balanceDisplay || "0.000000");
      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [address, requiredWhole]);

  if (!address) {
    // No wallet – let parent show its own connect UI
    return fallback ?? children;
  }

  if (loading) return null;

  if (!allowed) {
    return (
      <div
        style={{
          marginTop: "120px",
          color: "#d5502c",
          fontFamily: "monospace",
          fontSize: "1.2rem",
          textAlign: "center",
        }}
      >
        ❌ Access denied.
        <br />
        You need at least <strong>1,000 $SUPRAWR</strong> to use this tool.
        <br />
        Detected balance: {balanceDisplay} $SUPRAWR
      </div>
    );
  }

  return children;
}
