"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RPC_BASE_URL, fetchSupraWrAccess } from "./TokenGate";

// --- utilities copied from GasFeeStats ---
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
  } catch { }
}

// Rank calculation
function computeHolderRankFromDisplay(balanceDisplay) {
  if (!balanceDisplay) return null;

  const cleanedInt = String(balanceDisplay)
    .split(".")[0]
    .replace(/,/g, "");

  let whole = 0n;
  try { whole = BigInt(cleanedInt || "0"); } catch { return null; }

  if (whole >= 10_000_000n) return "Primal Master";
  if (whole >= 1_000_000n) return "Primal Titan";
  if (whole >= 100_000n)   return "Primal Guardian";
  if (whole >= 1_000n)     return "Scaleborn";
  if (whole > 0n)          return "Hatchling";
  return null;
}

// compact balance
function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num/1000).toFixed(1)}K`;
  return `${(num/1_000_000).toFixed(2)}M`;
}


// ---------------- TOP-RIGHT BAR COMPONENT ----------------

export default function TopRightBar() {
  const [provider, setProvider] = useState(null);
  const [walletInstalled, setWalletInstalled] = useState(null);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");

  const [checkingAccess, setCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [supraWrBalanceDisplay, setSupraWrBalanceDisplay] = useState(null);
  const [holderRank, setHolderRank] = useState(null);

  const [showRankModal, setShowRankModal] = useState(false);

  // --- access check ---
  const runAccessCheck = useCallback(async (addr) => {
    if (!addr) {
      setHasAccess(false);
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      return false;
    }

    setCheckingAccess(true);
    try {
      const { hasAccess, balanceDisplay } = await fetchSupraWrAccess(addr);
      setHasAccess(!!hasAccess);
      setSupraWrBalanceDisplay(balanceDisplay || "0");
      setHolderRank(computeHolderRankFromDisplay(balanceDisplay));
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  // --- auto detect wallet ---
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
          }
        } catch {}
        return;
      }

      if (Date.now() - startTime > 5000) {
        clearInterval(id);
        if (!cancelled) setWalletInstalled(false);
      }
    }, 500);

    return () => { cancelled = true; clearInterval(id); };
  }, [runAccessCheck]);

  // --- wallet button handlers ---
  const handleWalletButtonClick = async () => {
    if (!provider) {
      setWalletInstalled(false);
      return;
    }

    if (connected) {
      await disconnectWallet(provider);
      setConnected(false);
      setAddress("");
      setHasAccess(null);
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      return;
    }

    try {
      const accounts = await connectAndGetAccounts(provider);
      if (accounts.length === 0) return;

      const addr = accounts[0];
      setAddress(addr);
      setConnected(true);
      await runAccessCheck(addr);
    } catch {}
  };

  const walletButtonLabel =
    walletInstalled === false && !provider
      ? "Install StarKey"
      : !connected
      ? "Connect Wallet"
      : "Disconnect Wallet";

  const isWalletButtonDisabled =
    (walletInstalled === false && !provider) || checkingAccess;


  // ------------------- RENDER -------------------
  return (
    <>
      <div className="top-right-bar">
        {/* GET SUPRAWR */}
        <a
          href="https://app.atmos.ag/en/token-studio/0x82ed1f483b5fc4ad105cef5330e480136d58156c30dc70cd2b9c342981997cee"
          target="_blank"
          rel="noopener noreferrer"
          className="get-suprawr-link"
        >
          Get $SUPRAWR
        </a>

        {/* Rank + balance */}
        {connected && supraWrBalanceDisplay && (
          <div className="holder-tier-display">
            {holderRank && (
              <button
                className="holder-tier-title-button"
                onClick={() => setShowRankModal(true)}
              >
                [{holderRank}]
              </button>
            )}
            <span className="holder-tier-balance">
              {formatCompactBalance(parseFloat(supraWrBalanceDisplay))} $SUPRAWR
            </span>
          </div>
        )}

        {/* Wallet */}
        <button
          className="top-right-wallet-button"
          onClick={handleWalletButtonClick}
          disabled={isWalletButtonDisabled}
          type="button"
        >
          {walletButtonLabel}
        </button>
      </div>

      {/* RANK MODAL */}
      {showRankModal && (
        <div className="tier-modal-overlay" onClick={() => setShowRankModal(false)}>
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tier-modal-header">
              <h3 className="tier-modal-title">$SUPRAWR Holder Ranks</h3>
              <button className="tier-modal-close" onClick={() => setShowRankModal(false)}>
                ×
              </button>
            </div>

            <div className="tier-modal-body">
              {holderRank && (
                <div className="tier-current">
                  Your rank{" "}
                  <span className="tier-current-name">{holderRank}</span>{" "}
                  <span className="tier-current-balance">
                    ({formatCompactBalance(parseFloat(supraWrBalanceDisplay))} $SUPRAWR)
                  </span>
                </div>
              )}

              <ul className="tier-list">
                <li className="tier-list-item">Hatchling <span className="tier-range">1 – 999</span></li>
                <li className="tier-list-item">Scaleborn <span className="tier-range">1k – 99k</span></li>
                <li className="tier-list-item">Primal Guardian <span className="tier-range">100k – 999k</span></li>
                <li className="tier-list-item">Primal Titan <span className="tier-range">1M – 9.9M</span></li>
                <li className="tier-list-item">Primal Master <span className="tier-range">10M+</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
