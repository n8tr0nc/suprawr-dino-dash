"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RPC_BASE_URL, fetchSupraWrAccess } from "./TokenGate";

// -------------------- BALANCE CONVERSION --------------------

function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;

  // Under 1000 → return raw number
  if (num < 1000) return num.toString();

  let val, rounded, display;

  if (num < 1_000_000) {
    // Thousands (K)
    val = num / 1000;
    rounded = Math.round(val * 10) / 10; // 1 decimal place max
    display = rounded % 1 === 0 ? `${rounded.toFixed(0)}K` : `${rounded}K`;
    return display;
  }

  // Millions (M)
  val = num / 1_000_000;

  // 2 decimal places before rounding
  const full = val.toFixed(3); // e.g., "1.524"
  const rounded2 = (Math.round(val * 100) / 100).toFixed(2); // "1.52"

  // If rounding dropped meaningful digits → add "~"
  const needsApprox = full.slice(0, 4) !== rounded2.slice(0, 4);

  return `${needsApprox ? "~" : ""}${rounded2}M`;
}

// Approx USD formatter from a SUPRA amount string like "472.957000"
function formatUsdApproxFromSupraString(supraStr, supraUsdPrice) {
  if (!supraStr || supraUsdPrice == null) return null;

  const n = Number(supraStr);
  if (!isFinite(n) || n <= 0) return null;

  const usd = n * supraUsdPrice;
  const abs = Math.abs(usd);

  // More precision for tiny values so they don't all show as $0.00
  let digits = 2;
  if (abs < 0.01) digits = 3;
  if (abs < 0.001) digits = 4;

  return usd.toFixed(digits);
}

// -------------------- WALLET DETECTION HELPERS --------------------

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
    console.warn("StarKey disconnect error (ignored):", e);
  }
}

// -------------------- GAS FORMATTER --------------------

function formatSupraFromUnits(units) {
  const decimals = 8n;
  const denom = 10n ** decimals;

  const whole = units / denom;
  const frac = units % denom;
  const fracStr = frac.toString().padStart(Number(decimals), "0").slice(0, 6);

  return `${whole.toString()}.${fracStr}`;
}

// -------------------- HOLDER RANK LOGIC --------------------

// We look only at the WHOLE token part of the balanceDisplay string.
// Ranks (whole SUPRAWR):
//  0                      -> no title
//  1 – 999                -> Hatchling
//  1,000 – 99,999         -> Scaleborn
//  100,000 – 999,999      -> Primal Guardian
//  1,000,000 – 9,999,999  -> Primal Titan
//  10,000,000+            -> Primal Master
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

// -------------------- TIMESTAMP HELPERS --------------------

// Try to extract a timestamp (ms) from a tx record in a defensive way.
function extractTxTimestampMs(tx) {
  if (!tx) return null;

  const header = tx.header || tx.block_header || tx.meta || {};
  const candidates = [
    header.timestamp,
    header.time,
    tx.timestamp,
    tx.time,
    tx.block_time,
  ];

  for (const cand of candidates) {
    if (!cand) continue;

    // Numeric timestamp
    if (typeof cand === "number") {
      // If it looks like seconds, convert to ms
      if (cand < 1e12) return cand * 1000;
      return cand;
    }

    // String timestamp
    if (typeof cand === "string") {
      const num = Number(cand);
      if (Number.isFinite(num) && num > 0) {
        if (num < 1e12) return num * 1000;
        return num;
      }

      const parsed = Date.parse(cand);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return null;
}

// -------------------- LIFETIME GAS FETCH --------------------

async function fetchLifetimeGasStats(
  address,
  pageSize = 100,
  maxPages = 5000,
  onPage
) {
  let totalUnits = 0n;
  let totalTx = 0;

  let startCursor = 0n;
  let page = 0;

  // For monthly calculation
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

    for (const tx of records) {
      const header = tx?.header;
      if (!header) continue;

      const price = BigInt(header.gas_unit_price ?? 0);
      const maxGas = BigInt(header.max_gas_amount ?? 0);

      if (price > 0n && maxGas > 0n) {
        totalUnits += price * maxGas;
      }

      // Track timestamps for monthly average
      const ts = extractTxTimestampMs(tx);
      if (ts != null) {
        if (earliestTs === null || ts < earliestTs) earliestTs = ts;
        if (latestTs === null || ts > latestTs) latestTs = ts;
      }
    }

    totalTx += records.length;

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

  let totalSupra = "0.000000";
  let avgSupra = "0.000000";
  let monthlyAvgSupra = null; // only set when we have ≥2 months

  if (totalUnits > 0n) {
    totalSupra = formatSupraFromUnits(totalUnits);

    if (totalTx > 0) {
      const avgUnits = totalUnits / BigInt(totalTx);
      avgSupra = formatSupraFromUnits(avgUnits);
    }

    // Monthly average (only if we have a meaningful time span)
    let months = 1;

    if (earliestTs != null && latestTs != null && latestTs > earliestTs) {
      const diffMs = latestTs - earliestTs;
      const approxMonths = diffMs / (30 * 24 * 60 * 60 * 1000); // 30d months
      months = Math.max(1, Math.round(approxMonths));
    }

    if (months >= 2) {
      const avgUnitsPerMonth = totalUnits / BigInt(months);
      monthlyAvgSupra = formatSupraFromUnits(avgUnitsPerMonth);
    }
  }

  return { totalTx, totalSupra, avgSupra, monthlyAvgSupra };
}

// -------------------- MAIN COMPONENT --------------------

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

  // Token-gate state
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [supraWrBalanceDisplay, setSupraWrBalanceDisplay] = useState(null);
  const [holderRank, setHolderRank] = useState(null);

  // Rank modal
  const [showRankModal, setShowRankModal] = useState(false);

  // Live SUPRA price (USD)
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  // -------------------- ACCESS CHECK (define BEFORE useEffect) --------------------

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
      setSupraWrBalanceDisplay(balanceDisplay || "0.000000");

      const rank = computeHolderRankFromDisplay(balanceDisplay);
      setHolderRank(rank);

      if (!hasAccess) {
        setError(
          "Access denied: this wallet must hold at least 1,000 $SUPRAWR to use this tool."
        );
      } else {
        setError("");
      }

      return !!hasAccess;
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  // -------------------- AUTO-DETECT PROVIDER / RESTORE CONNECTION --------------------

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

            // Re-run token gate on refresh so rank + balance show up
            await runAccessCheck(addr);
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
  }, [runAccessCheck]);

  // -------------------- FETCH LIVE SUPRA PRICE --------------------

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

    // Optional: refresh every 60 seconds
    const id = setInterval(fetchPrice, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // -------------------- MAIN ACTION HANDLERS --------------------

  const handleAction = useCallback(
    async () => {
      setError("");

      if (!provider) {
        setWalletInstalled(false);
        setError("StarKey wallet extension is not detected in this browser.");
        return;
      }

      // STEP 1: CONNECT (if not yet connected)
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

          // Immediately run token gate on the connected wallet
          await runAccessCheck(addr);
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

        // First click only connects + checks access
        return;
      }

      // STEP 2: Already connected → verify SUPRAWR gate BEFORE calculating
      if (!address) {
        setError("No wallet address available. Please connect again.");
        return;
      }

      const allowed = await runAccessCheck(address);
      if (!allowed) {
        // Gate failed → do NOT calculate
        return;
      }

      // STEP 3: CALCULATE LIFETIME GAS (COIN TX ONLY)
      try {
        setCalculating(true);
        setError("");
        setTotalSupra(null);
        setAvgSupra(null);
        setMonthlyAvgSupra(null);
        setTxCount(0);
        setPagesProcessed(0);
        setProgressPercent(5);

        const { totalTx, totalSupra, avgSupra, monthlyAvgSupra } =
          await fetchLifetimeGasStats(address, 100, 5000, ({ page }) => {
            setPagesProcessed(page);
            setProgressPercent((prev) => {
              const next = prev + 4;
              return next >= 95 ? 95 : next;
            });
          });

        setPagesProcessed((prev) => (prev === 0 ? 1 : prev));
        setProgressPercent(100);
        await new Promise((resolve) => setTimeout(resolve, 250));

        setTxCount(totalTx);
        setTotalSupra(totalSupra);
        setAvgSupra(avgSupra);
        setMonthlyAvgSupra(monthlyAvgSupra);
      } catch (e) {
        console.error(e);
        setError("Unable to fetch full coin transaction history from Supra RPC.");
        setProgressPercent(0);
        setPagesProcessed(0);
      } finally {
        setCalculating(false);
      }
    },
    [provider, connected, address, runAccessCheck]
  );

  const handleDisconnect = useCallback(
    async () => {
      setError("");
      await disconnectWallet(provider);

      setConnected(false);
      setAddress("");
      setTotalSupra(null);
      setAvgSupra(null);
      setMonthlyAvgSupra(null);
      setTxCount(0);
      setPagesProcessed(0);
      setProgressPercent(0);
      setHasAccess(null);
      setSupraWrBalanceDisplay(null);
      setHolderRank(null);
      setShowRankModal(false);
    },
    [provider]
  );

  // Top-right wallet button (Connect / Disconnect only)
  const handleWalletButtonClick = useCallback(
    async () => {
      if (connected) {
        await handleDisconnect();
      } else {
        await handleAction(); // connect + gate branch when not connected
      }
    },
    [connected, handleAction, handleDisconnect]
  );

  const walletButtonLabel =
    walletInstalled === false && !provider
      ? "Install StarKey"
      : !connected
      ? connecting
        ? "Connecting…"
        : "Connect Wallet"
      : "Disconnect Wallet";

  const isWalletButtonDisabled =
    (walletInstalled === false && !provider) ||
    connecting ||
    calculating ||
    checkingAccess;

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
      : "Calculate Total Fees";

  const isButtonDisabled =
    (walletInstalled === false && !provider) ||
    connecting ||
    calculating ||
    checkingAccess ||
    (connected && hasAccess === false);

  // Precompute USD strings for results using live price
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

  // -------------------- RENDER --------------------

  return (
    <>
      <section className="gas-card">
        <div className="gas-header">
          <div className="gas-header-left">
            {/* GAS ICON inside the card */}
            <div className="gas-icon-circle">
              <span className="gas-icon" role="img" aria-label="Gas icon">
                ⛽
              </span>
            </div>
            <div>
              <h2 className="gas-title">GAS TRACKER</h2>
              <p className="gas-subtitle">
                Estimates gas spent on{" "}
                <strong>coin ($SUPRA) transactions only</strong> for your
                connected wallet using Supra&apos;s public RPC.
              </p>
            </div>
          </div>
        </div>

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

        <button
          className="primary-button"
          onClick={handleAction}
          disabled={isButtonDisabled}
          type="button"
        >
          {buttonLabel}
        </button>

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
                {txCount.toLocaleString ? txCount.toLocaleString() : txCount}
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
                  Average estimated gas per coin txs
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

        <p className="note">
          This tool uses the public Supra RPC <code>coin_transactions</code>{" "}
          endpoint only. It includes transactions with SUPRA coin movement for
          your wallet, but may exclude some contract-only or system transactions
          that explorers display. When actual <code>gas_used</code> is not
          available, it estimates fees using{" "}
          <code>max_gas_amount × gas_unit_price</code>, which can slightly
          overestimate total gas spent.
        </p>
      </section>
    </>
  );
}
