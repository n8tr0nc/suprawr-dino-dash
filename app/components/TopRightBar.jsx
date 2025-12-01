"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RPC_BASE_URL, fetchSupraWrAccess } from "./TokenGate";

/* ------------------------------------------------------------------
   PROVIDER + NORMALIZATION UTILITIES (shared with GasFeeStats)
------------------------------------------------------------------ */

function detectRawProvider() {
  if (typeof window === "undefined") return null;
  const w = window;

  if (w.starkey && (w.starkey.supra || w.starkey.provider)) {
    return w.starkey.supra || w.starkey.provider;
  }
  if (w.starKeyWallet) return w.starKeyWallet;
  if (w.starKey) return w.starKey;
  return null;
}

function normalizeAddress(acc) {
  if (!acc) return null;
  if (typeof acc === "string") return acc;

  return (
    acc.address ||
    acc.supraAddress ||
    acc.account_address ||
    acc.publicKey ||
    acc.owner ||
    null
  );
}

function normalizeAccounts(response) {
  if (!response) return [];
  if (Array.isArray(response)) {
    return response.map((a) => normalizeAddress(a)).filter(Boolean);
  }
  const single = normalizeAddress(response);
  return single ? [single] : [];
}

async function connectAndGetAccounts(provider) {
  if (typeof provider.connect === "function") {
    const res = await provider.connect();
    return normalizeAccounts(res);
  }

  if (typeof provider.connectWallet === "function") {
    try {
      await provider.connectWallet({ multiple: false, network: "SUPRA" });
    } catch {
      await provider.connectWallet();
    }

    if (typeof provider.getCurrentAccount === "function") {
      const acc = await provider.getCurrentAccount();
      return normalizeAccounts(acc);
    }
  }

  if (typeof provider.account === "function") {
    const res = await provider.account();
    return normalizeAccounts(res);
  }

  return [];
}

async function getExistingAccounts(provider) {
  if (!provider) return [];
  if (typeof provider.account === "function") {
    return normalizeAccounts(await provider.account());
  }
  if (typeof provider.getCurrentAccount === "function") {
    return normalizeAccounts(await provider.getCurrentAccount());
  }
  return [];
}

async function disconnectWallet(provider) {
  if (!provider) return;
  try {
    if (typeof provider.disconnect === "function") {
      await provider.disconnect();
    } else if (typeof provider.disconnectWallet === "function") {
      await provider.disconnectWallet();
    }
  } catch {}
}

/* ------------------------------------------------------------------
   GLOBAL EVENTS
------------------------------------------------------------------ */

function broadcastWalletState(address, connected) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("suprawr:walletChange", {
      detail: { address, connected },
    })
  );
}

function broadcastTierState(holderRank, balanceDisplay) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("suprawr:tierUpdate", {
      detail: { holderRank, balanceDisplay },
    })
  );
}

/* ------------------------------------------------------------------
   RANK + BALANCE HELPERS
------------------------------------------------------------------ */

function computeHolderRankFromDisplay(balanceDisplay) {
  if (!balanceDisplay) return null;

  const cleanedInt = String(balanceDisplay)
    .split(".")[0]
    .replace(/,/g, "");

  let whole = 0n;
  try {
    whole = BigInt(cleanedInt || "0");
  } catch {
    return null;
  }

  if (whole >= 10_000_000n) return "Primal Master";
  if (whole >= 1_000_000n) return "Primal Titan";
  if (whole >= 100_000n) return "Primal Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  if (whole > 0n) return "Hatchling";
  return null;
}

function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1_000_000).toFixed(2)}M`;
}

/* ------------------------------------------------------------------
   TOP RIGHT BAR COMPONENT
------------------------------------------------------------------ */

export default function TopRightBar({ onToggleSidebar }) {
  const [provider, setProvider] = useState(null);
  const [walletInstalled, setWalletInstalled] = useState(null);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");

  const [checkingAccess, setCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [supraWrBalanceDisplay, setSupraWrBalanceDisplay] = useState(null);
  const [holderRank, setHolderRank] = useState(null);

  /* ------------------------------------------------------------------
     ACCESS CHECKER
  ------------------------------------------------------------------ */

  const runAccessCheck = useCallback(async (addr) => {
    if (!addr) {
      setHasAccess(null);
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      broadcastTierState(null, null);
      return false;
    }

    setCheckingAccess(true);
    try {
      const { hasAccess, balanceDisplay } = await fetchSupraWrAccess(addr);
      const rank = computeHolderRankFromDisplay(balanceDisplay);

      setHasAccess(!!hasAccess);
      setSupraWrBalanceDisplay(balanceDisplay || "0");
      setHolderRank(rank);

      broadcastTierState(rank, balanceDisplay || "0");
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  /* ------------------------------------------------------------------
     AUTO-DETECT WALLET ON LOAD
  ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    const id = setInterval(async () => {
      if (cancelled) return;

      const raw = detectRawProvider();
      if (raw) {
        clearInterval(id);
        setProvider(raw);
        setWalletInstalled(true);

        try {
          const existing = await getExistingAccounts(raw);
          if (existing.length > 0) {
            const addr = existing[0];
            setConnected(true);
            setAddress(addr);
            await runAccessCheck(addr);

            // Sync with rest of UI
            broadcastWalletState(addr, true);
          }
        } catch {}
        return;
      }

      if (Date.now() - startTime > 5000) {
        clearInterval(id);
        if (!cancelled) setWalletInstalled(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runAccessCheck]);

  /* ------------------------------------------------------------------
     LISTEN FOR GLOBAL WALLET SYNC EVENTS
  ------------------------------------------------------------------ */

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { address: addr, connected: isConnected } = event.detail || {};

      setConnected(!!isConnected);
      setAddress(addr || "");

      if (addr && isConnected) {
        runAccessCheck(addr);
      } else {
        setHasAccess(null);
        setSupraWrBalanceDisplay(null);
        setHolderRank(null);
        broadcastTierState(null, null);
      }
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
    };
  }, [runAccessCheck]);

  /* ------------------------------------------------------------------
     CONNECT / DISCONNECT BUTTON HANDLER
  ------------------------------------------------------------------ */

  const handleWalletButtonClick = async () => {
    if (!provider) {
      setWalletInstalled(false);
      return;
    }

    // DISCONNECT
    if (connected) {
      await disconnectWallet(provider);

      broadcastWalletState("", false);
      broadcastTierState(null, null);

      setConnected(false);
      setAddress("");
      setHasAccess(null);
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      return;
    }

    // CONNECT
    try {
      const accounts = await connectAndGetAccounts(provider);
      if (accounts.length === 0) return;

      const addr = accounts[0];
      setAddress(addr);
      setConnected(true);
      await runAccessCheck(addr);

      // Sync to GasFeeStats + entire app
      broadcastWalletState(addr, true);
    } catch {}
  };

  /* ------------------------------------------------------------------
     BUTTON STATE
  ------------------------------------------------------------------ */

  const walletButtonLabel =
    walletInstalled === false && !provider
      ? "Install StarKey"
      : !connected
      ? "Connect Wallet"
      : "Disconnect";

  const isWalletButtonDisabled =
    (walletInstalled === false && !provider) || checkingAccess;

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */

  return (
    <div className="top-right-bar">
      {typeof onToggleSidebar === "function" && (
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label="Open navigation"
          onClick={onToggleSidebar}
        >
          ☰
        </button>
      )}

      <button
        className="top-right-wallet-button"
        onClick={handleWalletButtonClick}
        disabled={isWalletButtonDisabled}
        type="button"
      >
        {walletButtonLabel}
      </button>
    </div>
  );
}
