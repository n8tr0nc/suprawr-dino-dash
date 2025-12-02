"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RPC_BASE_URL, fetchSupraWrAccess } from "./TokenGate";

//
// ====================
// BALANCE CONVERSION
// ====================
//

function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;

  if (num < 1000) return num.toString();

  let val, rounded, display;

  if (num < 1_000_000) {
    val = num / 1000;
    rounded = Math.round(val * 10) / 10;
    display = rounded % 1 === 0 ? `${rounded.toFixed(0)}K` : `${rounded}K`;
    return display;
  }

  val = num / 1_000_000;
  const full = val.toFixed(3);
  const rounded2 = (Math.round(val * 100) / 100).toFixed(2);
  const needsApprox = full.slice(0, 4) !== rounded2.slice(0, 4);

  return `${needsApprox ? "~" : ""}${rounded2}M`;
}

function formatUsdApproxFromSupraString(supraStr, supraUsdPrice) {
  if (!supraStr || supraUsdPrice == null) return null;

  const n = Number(supraStr);
  if (!isFinite(n) || n <= 0) return null;

  const usd = n * supraUsdPrice;
  const abs = Math.abs(usd);

  let digits = 2;
  if (abs < 0.01) digits = 3;
  if (abs < 0.001) digits = 4;

  return usd.toFixed(digits);
}

//
// ======================
// WALLET DETECTION
// ======================
//

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
    const out = [];
    for (const item of response) {
      const addr = normalizeAddress(item);
      if (addr) out.push(addr);
    }
    return out;
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
    const res = await provider.account();
    return normalizeAccounts(res);
  }

  if (typeof provider.getCurrentAccount === "function") {
    const acc = await provider.getCurrentAccount();
    return normalizeAccounts(acc);
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
  } catch (e) {
    console.warn("StarKey disconnect error:", e);
  }
}

function broadcastWalletState(address, connected) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("suprawr:walletChange", {
      detail: { address, connected },
    })
  );
}

//
// ====================
// GAS FORMATTER
// ====================
//

function formatSupraFromUnits(units) {
  const decimals = 8n;
  const denom = 10n ** decimals;

  const whole = units / denom;
  const frac = units % denom;
  const fracStr = frac.toString().padStart(Number(decimals), "0").slice(0, 6);

  return `${whole.toString()}.${fracStr}`;
}

// -------------------- HOLDER RANK LOGIC --------------------

function computeHolderRankFromDisplay(balanceDisplay) {
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

  if (whole >= 10_000_000n) return "Primal Master";
  if (whole >= 1_000_000n) return "Primal Titan";
  if (whole >= 100_000n) return "Primal Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  return "Hatchling";
}

//
// ==========================
// TIMESTAMP EXTRACTION
// ==========================
//

function parseTimestampValue(val) {
  if (val == null) return null;

  if (typeof val === "number") {
    const num = val;
    if (!Number.isFinite(num) || num <= 0) return null;
    return num < 1e12 ? num * 1000 : num;
  }

  if (typeof val === "bigint") {
    const asNum = Number(val);
    if (!Number.isFinite(asNum) || asNum <= 0) return null;
    return asNum < 1e12 ? asNum * 1000 : asNum;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      return num < 1e12 ? num * 1000 : num;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

function extractTxTimestampMs(tx) {
  if (!tx) return null;

  const header = tx?.header || tx?.block_header || tx?.meta || {};

  // DIRECT Supra fields
  const direct = [
    header.block_unix_time,
    header.block_unix_timestamp,
    header.blockTimestamp,
  ];

  for (const cand of direct) {
    const parsed = parseTimestampValue(cand);
    if (parsed != null) return parsed;
  }

  // fallback to your existing scan
  const explicitCandidates = [
    header.timestamp,
    header.time,
    header.block_timestamp,
    header.block_timestamp_ms,
    header.commit_timestamp,
    tx.timestamp,
    tx.time,
    tx.block_time,
  ];

  for (const cand of explicitCandidates) {
    const parsed = parseTimestampValue(cand);
    if (parsed != null) return parsed;
  }

  // generic field scan
  const objectsToScan = [header, tx];
  for (const obj of objectsToScan) {
    if (!obj || typeof obj !== "object") continue;

    for (const [key, val] of Object.entries(obj)) {
      const k = key.toLowerCase();
      if (!k.includes("time")) continue;

      const parsed = parseTimestampValue(val);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

//
// =========================================================
// UPDATED LIFETIME GAS FETCH — NOW WITH HISTORY + CUMULATIVE
// =========================================================
//

async function fetchLifetimeGasStats(
  address,
  pageSize = 100,
  maxPages = 5000,
  onPage
) {
  let totalUnits = 0n;
  let totalTx = 0;

  // NEW: history arrays
  const history = [];
  const cumulativeHistory = [];
  let runningUnits = 0n;

  let startCursor = 0n;
  let page = 0;

  let earliestTs = null;
  let latestTs = null;

  while (page < maxPages) {
    const params = new URLSearchParams();
    params.set("count", String(pageSize));
    params.set("start", startCursor.toString());

    const url = `${RPC_BASE_URL}/rpc/v2/accounts/${address}/coin_transactions?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`RPC error ${res.status}`);

    const data = await res.json();
    const records = Array.isArray(data?.record) ? data.record : [];

    if (records.length === 0) break;

    // PROCESS TX RECORDS
    for (const tx of records) {
      const header = tx.header;
      if (!header) continue;

      const price = BigInt(header.gas_unit_price ?? 0);
      const maxGas = BigInt(header.max_gas_amount ?? 0);

      const gasUnits = price > 0n && maxGas > 0n ? price * maxGas : 0n;

      if (gasUnits > 0n) {
        totalUnits += gasUnits;

        const ts = extractTxTimestampMs(tx);
        if (ts != null) {
          // Track earliest/latest
          if (earliestTs === null || ts < earliestTs) earliestTs = ts;
          if (latestTs === null || ts > latestTs) latestTs = ts;

          // NEW: push per-TX point
          history.push({
            ts,
            gasUnits,
            gasSupra: formatSupraFromUnits(gasUnits),
          });

          // NEW: cumulative
          runningUnits += gasUnits;
          cumulativeHistory.push({
            ts,
            cumulativeUnits: runningUnits,
            gasSupra: formatSupraFromUnits(runningUnits),
          });
        }
      }
    }

    totalTx += records.length;

    // Progress callback
    if (typeof onPage === "function") {
      onPage({
        page: page + 1,
        totalTx,
        batchSize: records.length,
      });
    }

    const nextCursor = data?.cursor;
    if (nextCursor === undefined || nextCursor === null) break;

    startCursor = BigInt(nextCursor);
    page += 1;

    if (records.length < pageSize) break;
  }

  //
  // FINAL TOTALS
  //

  let totalSupra = "0.000000";
  let avgSupra = "0.000000";
  let monthlyAvgSupra = null;

  if (totalUnits > 0n) {
    totalSupra = formatSupraFromUnits(totalUnits);

    if (totalTx > 0) {
      const avgUnits = totalUnits / BigInt(totalTx);
      avgSupra = formatSupraFromUnits(avgUnits);
    }

    let months = 1;

    if (earliestTs != null && latestTs != null && latestTs > earliestTs) {
      const diffMs = latestTs - earliestTs;
      const approxMonths = diffMs / (30 * 24 * 60 * 60 * 1000);
      months = Math.max(1, Math.round(approxMonths));
    }

    if (months >= 2) {
      const avgUnitsPerMonth = totalUnits / BigInt(months);
      monthlyAvgSupra = formatSupraFromUnits(avgUnitsPerMonth);
    }
  }

  const latestTxTimestampMs = latestTs ?? null;

  return {
    totalTx,
    totalSupra,
    avgSupra,
    monthlyAvgSupra,
    latestTxTimestampMs,

    // NEW RETURN VALUES:
    history,
    cumulativeHistory,
  };
}

//
// ===========================
// LOCAL CACHE HELPERS
// ===========================
//

const GAS_CACHE_PREFIX = "suprawr_gas_cache_v1:";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

function getGasCacheKey(address) {
  if (!address) return null;
  return `${GAS_CACHE_PREFIX}${address.toLowerCase()}`;
}

function loadGasCache(address) {
  if (typeof window === "undefined") return null;
  const key = getGasCacheKey(address);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.address) return null;
    if (parsed.address.toLowerCase() !== address.toLowerCase()) return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveGasCache(address, payload) {
  if (typeof window === "undefined") return;
  const key = getGasCacheKey(address);
  if (!key) return;

  try {
    const toStore = {
      address,
      updatedAtMs: Date.now(),
      ...payload,
    };
    window.localStorage.setItem(key, JSON.stringify(toStore));
  } catch {
    // ignore errors
  }
}

//
// ===========================
// MAIN COMPONENT
// ===========================
//

export default function GasFeeStats() {
  const [provider, setProvider] = useState(null);
  const [walletInstalled, setWalletInstalled] = useState(null);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");

  const [txCount, setTxCount] = useState(0);
  const [totalSupra, setTotalSupra] = useState(null);
  const [avgSupra, setAvgSupra] = useState(null);
  const [monthlyAvgSupra, setMonthlyAvgSupra] = useState(null);

  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  const [checkingAccess, setCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [supraWrBalanceDisplay, setSupraWrBalanceDisplay] = useState(null);
  const [holderRank, setHolderRank] = useState(null);

  const [showRankModal, setShowRankModal] = useState(false);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  const [showInfo, setShowInfo] = useState(false);

  //
  // NEW: GAS HISTORY STATE FOR CHART COMPONENT
  //
  const [history, setHistory] = useState([]);
  const [cumulativeHistory, setCumulativeHistory] = useState([]);

  //
  // ACCESS CHECK (unchanged)
  //
  const runAccessCheck = useCallback(async (addr) => {
    if (!addr) {
      setHasAccess(null);
      setError("");
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      return false;
    }

    setCheckingAccess(true);
    try {
      const { hasAccess, balanceDisplay } = await fetchSupraWrAccess(addr);

      setHasAccess(!!hasAccess);
      if (hasAccess) setError("");
      setSupraWrBalanceDisplay(balanceDisplay || "0.000000");

      const rank = computeHolderRankFromDisplay(balanceDisplay);
      setHolderRank(rank);

      if (!hasAccess) {
        setError(
          "Access denied: this wallet must hold at least 1,000 $SUPRAWR to use this tool."
        );
      }

      return !!hasAccess;
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  //
  // MAIN GAS CALCULATION — UPDATED TO STORE HISTORY
  //
  const runGasCalculationWithCache = useCallback(
    async (addr) => {
      if (!addr) return;

      try {
        setCalculating(true);
        setError("");
        setTotalSupra(null);
        setAvgSupra(null);
        setMonthlyAvgSupra(null);
        setTxCount(0);
        setPagesProcessed(0);
        setProgressPercent(5);

        // Reset chart history before scanning
        setHistory([]);
        setCumulativeHistory([]);

        const {
          totalTx,
          totalSupra,
          avgSupra,
          monthlyAvgSupra,
          history: newHistory,
          cumulativeHistory: newCumulative,
        } = await fetchLifetimeGasStats(addr, 100, 5000, ({ page }) => {
          setPagesProcessed(page);
          setProgressPercent((prev) => {
            const next = prev + 4;
            return next >= 95 ? 95 : next;
          });
        });

        // Save history arrays for the chart
        setHistory(newHistory || []);
        setCumulativeHistory(newCumulative || []);

        setPagesProcessed((prev) => (prev === 0 ? 1 : prev));
        setProgressPercent(100);
        await new Promise((r) => setTimeout(r, 250));

        setTxCount(totalTx);
        setTotalSupra(totalSupra);
        setAvgSupra(avgSupra);
        setMonthlyAvgSupra(monthlyAvgSupra);

        saveGasCache(addr, {
          totalTx,
          totalSupra,
          avgSupra,
          monthlyAvgSupra,
          history: newHistory || [],
          cumulativeHistory: newCumulative || [],
        });
      } catch (e) {
        console.error(e);
        setError("Unable to fetch full coin transaction history from Supra RPC.");
        setProgressPercent(0);
        setPagesProcessed(0);
      } finally {
        setCalculating(false);
      }
    },
    []
  );

  //
  // ACCESS + CACHE LOGIC — UPDATED TO RESTORE HISTORY ARRAYS
  //
  const runAccessAndMaybeCalc = useCallback(
    async (addr) => {
      if (!addr) return;
      setError("");

      // 1. ACCESS CHECK
      const allowed = await runAccessCheck(addr);
      if (!allowed) return;

      // 2. LOAD CACHE
      const cache = loadGasCache(addr);

      if (!cache) {
        await runGasCalculationWithCache(addr);
        return;
      }

      // Restore results
      setTxCount(cache.totalTx || 0);
      setTotalSupra(cache.totalSupra || null);
      setAvgSupra(cache.avgSupra || null);
      setMonthlyAvgSupra(cache.monthlyAvgSupra || null);

      // Restore chart history from cache
      setHistory(cache.history || []);
      setCumulativeHistory(cache.cumulativeHistory || []);

      setPagesProcessed(0);
      setProgressPercent(0);

      // TTL check
      const updatedAtMs =
        typeof cache.updatedAtMs === "number" ? cache.updatedAtMs : 0;
      const cacheAgeMs = Date.now() - updatedAtMs;

      if (cacheAgeMs <= MAX_CACHE_AGE_MS) {
        return;
      }

      // Cache old → recalc
      setTxCount(0);
      setTotalSupra(null);
      setAvgSupra(null);
      setMonthlyAvgSupra(null);
      setPagesProcessed(0);
      setProgressPercent(0);

      await runGasCalculationWithCache(addr);
    },
    [runAccessCheck, runGasCalculationWithCache]
  );

    //
  // WALLET AUTO-DETECT ON LOAD
  //
  useEffect(() => {
    let cancelled = false;
    setWalletInstalled(null);

    const startTime = Date.now();

    const intervalId = setInterval(async () => {
      if (cancelled) return;

      const raw = detectRawProvider();
      if (raw) {
        clearInterval(intervalId);
        setProvider(raw);
        setWalletInstalled(true);

        try {
          const existing = await getExistingAccounts(raw);
          if (existing.length > 0) {
            const addr = existing[0];
            setConnected(true);
            setAddress(addr);
            runAccessAndMaybeCalc(addr);
          }
        } catch {
          // ignore
        }
        return;
      }

      if (Date.now() - startTime > 5000) {
        clearInterval(intervalId);
        if (!cancelled) setWalletInstalled(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [runAccessAndMaybeCalc]);

  //
  // SUPRA PRICE POLLING
  //
  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch("/api/supra-price");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data.priceUsd === "number") {
          setSupraUsdPrice(data.priceUsd);
        }
      } catch (err) {
        console.error("Failed to fetch SUPRA price:", err);
      }
    }

    fetchPrice();
    const id = setInterval(fetchPrice, 60000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  //
  // WALLET CHANGE LISTENER (FROM TopRightBar)
  //
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { address: newAddr, connected: isConnected } = event.detail || {};

      if (newAddr === address && isConnected === connected) {
        return;
      }

      setConnected(!!isConnected);
      setAddress(newAddr || "");

      // Reset outputs
      setTxCount(0);
      setTotalSupra(null);
      setAvgSupra(null);
      setMonthlyAvgSupra(null);
      setPagesProcessed(0);
      setProgressPercent(0);

      // Reset chart data
      setHistory([]);
      setCumulativeHistory([]);

      if (!isConnected || !newAddr) {
        setHasAccess(null);
        setSupraWrBalanceDisplay(null);
        setHolderRank(null);
        setError("");
      } else {
        runAccessAndMaybeCalc(newAddr);
      }
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
    };
  }, [address, connected, runAccessAndMaybeCalc]);

  //
  // MAIN BUTTON ACTION — CONNECT OR CALCULATE
  //
  const handleAction = useCallback(
    async () => {
      setError("");

      if (!provider) {
        if (typeof window !== "undefined") {
          window.open("https://starkey.app", "_blank");
        }
        return;
      }

      // CONNECT FLOW
      if (!connected) {
        try {
          setConnecting(true);
          const accounts = await connectAndGetAccounts(provider);

          if (!accounts.length) {
            throw new Error("StarKey did not return any accounts.");
          }

          const addr = accounts[0];
          setAddress(addr);
          setConnected(true);

          broadcastWalletState(addr, true);
          await runAccessAndMaybeCalc(addr);
        } catch (e) {
          console.error(e);
          const msg =
            e?.code === 4001
              ? "Connection request was rejected in StarKey."
              : "Failed to connect StarKey wallet.";
          setError(msg);
        } finally {
          setConnecting(false);
        }
        return;
      }

      // CALCULATE FLOW
      if (!address) {
        setError("No wallet address available. Please connect again.");
        return;
      }

      const allowed = await runAccessCheck(address);
      if (!allowed) return;

      await runGasCalculationWithCache(address);
    },
    [
      provider,
      connected,
      address,
      runAccessCheck,
      runGasCalculationWithCache,
      runAccessAndMaybeCalc,
    ]
  );

  //
  // MANUAL DISCONNECT
  //
  const handleDisconnect = useCallback(async () => {
    setError("");
    await disconnectWallet(provider);

    broadcastWalletState("", false);

    setConnected(false);
    setAddress("");
    setHasAccess(null);
    setError("");
    setSupraWrBalanceDisplay(null);
    setHolderRank(null);
    setTotalSupra(null);
    setAvgSupra(null);
    setMonthlyAvgSupra(null);
    setTxCount(0);
    setPagesProcessed(0);
    setProgressPercent(0);
    setShowRankModal(false);

    // Clear chart data
    setHistory([]);
    setCumulativeHistory([]);
  }, [provider]);

  const handleWalletButtonClick = useCallback(async () => {
    if (connected) {
      await handleDisconnect();
    } else {
      await handleAction();
    }
  }, [connected, handleAction, handleDisconnect]);

  //
  // BUTTON LABELS
  //
  const walletButtonLabel =
    walletInstalled === false && !provider
      ? "Install StarKey"
      : !connected
      ? connecting
        ? "Connecting…"
        : "Connect Wallet"
      : "Disconnect Wallet";

  const isWalletButtonDisabled = connecting || calculating || checkingAccess;

  const buttonLabel =
    walletInstalled === false && !provider
      ? "Install StarKey Wallet"
      : !connected
      ? connecting
        ? "Connecting…"
        : "Connect StarKey Wallet"
      : checkingAccess
      ? "Checking Access…"
      : hasAccess === false
      ? "Access Denied (Need 1,000 $SUPRAWR)"
      : calculating
      ? "Calculating…"
      : totalSupra
      ? "Recalculate Gas Fees"
      : "Calculate Gas Fees";

  const isButtonDisabled =
    connecting ||
    calculating ||
    checkingAccess ||
    (connected && hasAccess === false);

  //
  // USD CONVERSIONS
  //
  const totalSupraUsdDisplay =
    totalSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(totalSupra, supraUsdPrice)
      : null;

  const avgSupraUsdDisplay =
    avgSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(avgSupra, supraUsdPrice)
      : null;

  const monthlyAvgUsdDisplay =
    monthlyAvgSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(monthlyAvgSupra, supraUsdPrice)
      : null;

  //
  // ======================================
  // JSX OUTPUT (GAS TRACKER UI)
  // ======================================
  //
  return (
    <>
      <section className="gas-card">
        <div className="dashboard-panel-header">
          <button
            className="gas-info-button"
            onClick={() => setShowInfo(true)}
            aria-label="Gas Tracker Info"
          >
            i
          </button>

          <span className="dashboard-panel-pill">Powered by Supra RPC</span>
        </div>

        {/* INFO MODAL */}
        {showInfo && (
          <div
            className="modal-001-overlay gas-info-overlay"
            onClick={() => setShowInfo(false)}
          >
            <div
              className="modal-001 gas-info-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-001-header gas-info-header">
                <h3 className="modal-001-title gas-info-title">
                  Gas Tracker Info
                </h3>
                <button
                  className="modal-001-close gas-info-close"
                  onClick={() => setShowInfo(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-001-body gas-info-body">
                <p>
                  This tool estimates gas spent on{" "}
                  <strong>coin ($SUPRA) transactions only</strong> for your
                  connected wallet using Supra’s public RPC.
                </p>
                <p>
                  It uses the <code>coin_transactions</code> endpoint and may
                  exclude contract-only or system-level activity. When{" "}
                  <code>gas_used</code> is unavailable, fees are estimated using{" "}
                  <code>max_gas_amount × gas_unit_price</code>.
                </p>
                <p>
                  The tool automatically calculates on wallet connection and{" "}
                  <strong>caches results for 24 hours</strong>. You can manually
                  force a recalculation using{" "}
                  <strong>Recalculate Gas Fees</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* WALLET FIELD */}
        <div className="field-block">
          <label htmlFor="wallet" className="field-label">
            Connected Supra Wallet
          </label>
          <input
            id="wallet"
            type="text"
            className="field-input"
            value={address}
            readOnly
            disabled
            placeholder="Connect StarKey to autofill your address"
          />
        </div>

        {/* MAIN BUTTON */}
        <button
          className="primary-button"
          onClick={handleAction}
          disabled={isButtonDisabled}
          type="button"
        >
          {buttonLabel}
        </button>

        {/* PROGRESS */}
        {calculating && (
          <div className="progress-wrapper">
            <div className="progress-label">
              Scanning coin txs... Pages processed: {pagesProcessed}
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {error && <div className="alert error">{error}</div>}

        {connected && hasAccess && !error && totalSupra && (
          <div className="results">
            <div className="result-row">
              <span className="result-label">Coin txs scanned</span>
              <span className="result-value">
                {txCount.toLocaleString
                  ? txCount.toLocaleString()
                  : txCount}
              </span>
            </div>

            <div className="result-row">
              <span className="result-label">
                Estimated gas spent on coin txs
              </span>
              <span className="result-value">
                ~{totalSupra} $SUPRA
                {totalSupraUsdDisplay && ` (~$${totalSupraUsdDisplay})`}
              </span>
            </div>

            {avgSupra && (
              <div className="result-row">
                <span className="result-label">
                  Average estimated gas per coin tx
                </span>
                <span className="result-value">
                  ~{avgSupra} $SUPRA
                  {avgSupraUsdDisplay && ` (~$${avgSupraUsdDisplay})`}
                </span>
              </div>
            )}

            {monthlyAvgSupra && (
              <div className="result-row">
                <span className="result-label">
                  Estimated gas spent per month
                </span>
                <span className="result-value">
                  ~{monthlyAvgSupra} $SUPRA
                  {monthlyAvgUsdDisplay && ` (~$${monthlyAvgUsdDisplay})`}
                </span>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

// END OF GasFeeStats component
