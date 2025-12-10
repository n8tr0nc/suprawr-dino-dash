"use client";

import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import { useWallet } from "../wallet/useWallet";
import { useStats } from "../stats/useStats";

// RPC base URL
const RPC_BASE_URL = "https://rpc-mainnet.supra.com";
const INFO_MODAL_ANIM_MS = 500; // match modal overlay animation duration

// -------------------- BALANCE CONVERSION --------------------

const DECIMALS = 9n;

function formatSupraFromRaw(raw) {
  if (raw == null) return null;

  let bi;
  try {
    bi = BigInt(raw);
  } catch {
    return null;
  }

  const divisor = 10n ** DECIMALS;
  const integerPart = bi / divisor;
  const fractionalPart = bi % divisor;

  const fractionalStr = fractionalPart.toString().padStart(Number(DECIMALS), "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  if (!trimmedFractional) {
    return integerPart.toString();
  }

  const combined = `${integerPart.toString()}.${trimmedFractional}`;
  const num = Number(combined);

  if (!Number.isFinite(num)) {
    return combined;
  }

  if (num === 0) {
    return "0";
  }

  if (num >= 1) {
    return num.toFixed(3);
  }

  if (num >= 0.001) {
    return num.toFixed(4);
  }

  return num.toFixed(6);
}

function formatSupraShort(raw) {
  if (raw == null) return null;

  const num = Number(raw);
  if (isNaN(num)) return raw;

  if (num >= 1_000_000_000) {
    const val = num / 1_000_000_000;
    const rounded2 = Math.round(val * 100) / 100;
    return `~${rounded2.toFixed(2)}B`;
  }

  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    const rounded2 = Math.round(val * 100) / 100;
    return `~${rounded2.toFixed(2)}M`;
  }

  if (num >= 1_000) {
    const val = num / 1_000;
    const rounded1 = Math.round(val * 10) / 10;
    return `~${rounded1.toFixed(1)}K`;
  }

  const roundedSmall = Math.round(num * 100) / 100;
  return `~${roundedSmall.toFixed(2)}`;
}

function formatUsdApproxFromSupraString(supraStr, supraUsdPrice) {
  if (!supraStr || supraUsdPrice == null) return null;

  const num = Number(supraStr);
  if (!Number.isFinite(num) || num <= 0) return null;

  const usd = num * supraUsdPrice;
  const abs = Math.abs(usd);

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    const full = val.toFixed(3);
    const rounded2 = (Math.round(val * 100) / 100).toFixed(2);
    const needsApprox = full.slice(0, 4) !== rounded2.slice(0, 4);

    return `${usd < 0 ? "-" : ""}${needsApprox ? "~" : ""}${rounded2}B`;
  }

  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const full = val.toFixed(3);
    const rounded2 = (Math.round(val * 100) / 100).toFixed(2);
    const needsApprox = full.slice(0, 4) !== rounded2.slice(0, 4);

    return `${usd < 0 ? "-" : ""}${needsApprox ? "~" : ""}${rounded2}M`;
  }

  if (abs >= 1) {
    return `${usd < 0 ? "-" : ""}$${abs.toFixed(2)}`;
  }

  if (abs >= 0.01) {
    return `${usd < 0 ? "-" : ""}$${abs.toFixed(4)}`;
  }

  return `${usd < 0 ? "-" : ""}$${abs.toFixed(6)}`;
}

// -------------------- GAS FORMATTER --------------------

function formatGasAmount(num) {
  if (num == null) return null;

  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "0";

  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    const rounded = Math.round(val * 100) / 100;
    return `~${rounded.toFixed(2)}B`;
  }

  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const rounded = Math.round(val * 100) / 100;
    return `~${rounded.toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    const val = abs / 1_000;
    const rounded = Math.round(val * 10) / 10;
    return `~${rounded.toFixed(1)}K`;
  }

  const roundedSmall = Math.round(abs * 100) / 100;
  return `~${roundedSmall.toFixed(2)}`;
}

// -------------------- RPC HELPERS --------------------

function extractTxTimestampMs(tx) {
  const millis = tx?.header?.timestamp_in_millis;
  if (millis != null) return Number(millis);

  const nanos = tx?.header?.timestamp_in_nanos;
  if (nanos != null) {
    const ns = BigInt(nanos);
    return Number(ns / 1_000_000n);
  }

  return null;
}

async function fetchAllCoinTransactions(address, onProgress) {
  const maxPages = 50;
  const pageSize = 50;
  let totalTx = 0;
  let totalGasUnits = 0n;
  let totalSupra = 0n;

  let earliestTs = null;
  let latestTs = null;

  let page = 0;
  let startCursor = 0n;

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
      const header = tx.header;
      if (!header) continue;

      const price = BigInt(header.gas_unit_price ?? 0);
      const maxGas = BigInt(header.max_gas_amount ?? 0);

      if (price > 0n && maxGas > 0n) {
        totalGasUnits += price * maxGas;
      }

      const ts = extractTxTimestampMs(tx);
      if (ts != null) {
        if (earliestTs === null || ts < earliestTs) earliestTs = ts;
        if (latestTs === null || ts > latestTs) latestTs = ts;
      }

      const input = tx?.transaction?.payload?.input;
      if (Array.isArray(input)) {
        for (const coin of input) {
          const amt = coin?.balance;
          if (amt != null) {
            totalSupra += BigInt(amt);
          }
        }
      }

      const output = tx?.transaction?.payload?.output;
      if (Array.isArray(output)) {
        for (const coin of output) {
          const amt = coin?.balance;
          if (amt != null) {
            totalSupra += BigInt(amt);
          }
        }
      }

      totalTx += 1;
    }

    startCursor += BigInt(pageSize);
    page += 1;

    if (typeof onProgress === "function") {
      onProgress({
        pagesProcessed: page,
        totalTx,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const timeWindowMs =
    earliestTs != null && latestTs != null ? latestTs - earliestTs : null;

  return {
    totalTx,
    totalGasUnits,
    totalSupra,
    timeWindowMs,
    latestTxTimestampMs: latestTs,
  };
}

// -------------------- LOCAL STORAGE HELPERS --------------------

const GAS_CACHE_KEY = "suprawr_gas_cache_v1";

function loadGasCache(address) {
  if (typeof window === "undefined") return null;
  if (!address) return null;

  try {
    const raw = window.localStorage.getItem(GAS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed[address];
    if (!record) return null;

    if (typeof record.timestamp !== "number") return null;

    const ageMs = Date.now() - record.timestamp;
    const maxAgeMs = 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) return null;

    return record;
  } catch {
    return null;
  }
}

function saveGasCache(address, data) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(GAS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    parsed[address] = {
      ...data,
      timestamp: Date.now(),
    };

    window.localStorage.setItem(GAS_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore cache write failures
  }
}

// -------------------- RIFT ENERGY HELPERS --------------------

const RIFT_COOLDOWN_KEY_PREFIX = "suprawr_rift_cooldown_v1_";
const COOLDOWN_MS = 90 * 1000;

function getRiftCooldownKey(address) {
  if (!address) return null;
  return `${RIFT_COOLDOWN_KEY_PREFIX}${address}`;
}

function loadRiftCooldown(address) {
  if (typeof window === "undefined") return null;
  const key = getRiftCooldownKey(address);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const endMs = Number(raw);
    return Number.isFinite(endMs) ? endMs : null;
  } catch {
    return null;
  }
}

function saveRiftCooldown(address, endMs) {
  if (typeof window === "undefined") return;
  const key = getRiftCooldownKey(address);
  if (!key) return;

  try {
    window.localStorage.setItem(key, String(endMs));
  } catch {
    // ignore storage failures
  }
}

// -------------------- MAIN COMPONENT --------------------

export default function GasFeeStats() {
  // Unified access + wallet state
  const { connected, address, connect } = useWallet();
  const {
    hasAccess,
    supraUsdPrice,
    loadingAccess,
    loadingBalances,
  } = useStats();

  // Track mount to keep walletInstalled SSR-safe
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [txCount, setTxCount] = useState(0);
  const [totalSupra, setTotalSupra] = useState(null);
  const [avgSupra, setAvgSupra] = useState(null);
  const [monthlyAvgSupra, setMonthlyAvgSupra] = useState(null);
  const [error, setError] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  const [showInfo, setShowInfo] = useState(false);
  const [isInfoExiting, setIsInfoExiting] = useState(false);
  const infoTimerRef = useRef(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [isDraining, setIsDraining] = useState(false);
  const [drainValue, setDrainValue] = useState(1);

  const [manualSyncActive, setManualSyncActive] = useState(false);

  const [cooldownEndMs, setCooldownEndMs] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const [hasStats, setHasStats] = useState(false);

  const calcRunIdRef = useRef(0);

  // Sounds
  const refreshSoundRef = useRef(null);
  const drainSoundRef = useRef(null);
  const drainSoundPlayedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!refreshSoundRef.current) {
      const audio = new Audio("/audio/refresh-002.mp3");
      audio.loop = true;
      audio.volume = 0.15;
      refreshSoundRef.current = audio;
    }

    if (!drainSoundRef.current) {
      const audio = new Audio("/audio/drain-003.mp3");
      audio.loop = false;
      audio.volume = 0.5;
      drainSoundRef.current = audio;
    }
  }, []);

  const stopRefreshSound = useCallback(() => {
    const audio = refreshSoundRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, []);

  const startRefreshSound = useCallback(() => {
    const audio = refreshSoundRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        audio
          .play()
          .catch(() => {});
      } catch {}
    }
  }, []);

  const playDrainSoundOnce = useCallback(() => {
    if (drainSoundPlayedRef.current) return;
    const audio = drainSoundRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {}
    }
    drainSoundPlayedRef.current = true;
  }, []);

  useEffect(() => {
    let rafId = null;

    if (isDraining) {
      const start = performance.now();
      const duration = 3000;

      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        setDrainValue(1 - t);
        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setIsDraining(false);
          setDrainValue(0);
        }
      };

      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isDraining]);

  useEffect(() => {
    if (!cooldownEndMs) return;

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEndMs]);

  useEffect(() => {
    return () => {
      stopRefreshSound();
    };
  }, [stopRefreshSound]);

  const openInfoModal = useCallback(() => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }

    setIsInfoExiting(false);
    setShowInfo(true);
  }, []);

  const closeInfoModal = useCallback(() => {
    if (!showInfo) return;

    setIsInfoExiting(true);

    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }

    infoTimerRef.current = setTimeout(() => {
      setShowInfo(false);
      setIsInfoExiting(false);
      infoTimerRef.current = null;
    }, INFO_MODAL_ANIM_MS);
  }, [showInfo]);

  const restoreFromCacheIfAvailable = useCallback(
    (addr) => {
      const cached = loadGasCache(addr);
      if (!cached) {
        setTxCount(0);
        setTotalSupra(null);
        setAvgSupra(null);
        setMonthlyAvgSupra(null);
        setPagesProcessed(0);
        setProgressPercent(0);
        setHasStats(false);
        setLastSyncTime(null);
        return;
      }

      setTxCount(cached.totalTx ?? 0);
      setTotalSupra(cached.totalSupra ?? null);
      setAvgSupra(cached.avgSupra ?? null);
      setMonthlyAvgSupra(cached.monthlyAvgSupra ?? null);
      setPagesProcessed(cached.pagesProcessed ?? 0);
      setProgressPercent(cached.progressPercent ?? 0);
      setHasStats(true);
      setLastSyncTime(cached.lastSyncTime ?? cached.timestamp ?? null);
    },
    []
  );

  const startRiftCooldown = useCallback(
    (addr) => {
      const end = Date.now() + COOLDOWN_MS;
      setCooldownEndMs(end);
      saveRiftCooldown(addr, end);
    },
    []
  );

  const runGasCalculationWithCache = useCallback(
    async (addr, options = {}) => {
      if (!addr) return;
      const { isManualRecalc = false } = options;

      const runId = ++calcRunIdRef.current;

      try {
        setCalculating(true);
        setError("");

        setIsDraining(true);
        setDrainValue(1);
        playDrainSoundOnce();
        startRefreshSound();

        const {
          totalTx,
          totalGasUnits,
          totalSupra,
          timeWindowMs,
          latestTxTimestampMs,
        } = await fetchAllCoinTransactions(addr, ({ pagesProcessed, totalTx }) => {
          if (calcRunIdRef.current !== runId) {
            return;
          }

          setPagesProcessed(pagesProcessed);

          const approxTotalPages = Math.max(pagesProcessed, Math.ceil(totalTx / 50));
          const progress = approxTotalPages
            ? Math.min(100, Math.floor((pagesProcessed / approxTotalPages) * 100))
            : 0;

          setProgressPercent(progress);
        });

        if (calcRunIdRef.current !== runId) {
          return;
        }

        stopRefreshSound();
        setIsDraining(false);
        setDrainValue(0);

        const totalSupraDisplay = formatSupraFromRaw(totalSupra.toString());
        const avgSupra =
          totalTx > 0 ? (Number(totalSupra) / totalTx).toFixed(6) : "0";
        const avgSupraDisplay = formatSupraFromRaw(avgSupra);
        let monthlyAvgSupra = null;

        if (timeWindowMs && timeWindowMs > 0) {
          const days = timeWindowMs / (1000 * 60 * 60 * 24);
          const perDay =
            days > 0 ? Number(totalSupraDisplay || "0") / days : null;

          if (perDay != null && Number.isFinite(perDay)) {
            monthlyAvgSupra = (perDay * 30).toFixed(6);
          }
        }

        setProgressPercent(100);
        await new Promise((resolve) => setTimeout(resolve, 250));

        setTxCount(totalTx);
        setTotalSupra(totalSupraDisplay);
        setAvgSupra(avgSupraDisplay);
        setMonthlyAvgSupra(monthlyAvgSupra);
        setHasStats(true);
        const syncTime = latestTxTimestampMs || Date.now();
        setLastSyncTime(syncTime);

        saveGasCache(addr, {
          totalTx,
          totalSupra: totalSupraDisplay,
          avgSupra: avgSupraDisplay,
          monthlyAvgSupra,
          pagesProcessed,
          progressPercent: 100,
          lastSyncTime: syncTime,
        });

        if (isManualRecalc) {
          startRiftCooldown(addr);
        }
      } catch (e) {
        console.error(e);
        setError(
          "Unable to fetch full coin transaction history from Supra RPC."
        );
        setProgressPercent(0);
        setPagesProcessed(0);
      } finally {
        stopRefreshSound();
        setIsDraining(false);
        setDrainValue(1);
        setCalculating(false);
      }
    },
    [playDrainSoundOnce, startRefreshSound, stopRefreshSound, startRiftCooldown]
  );

  const runAccessAndMaybeCalc = useCallback(
    async (addr) => {
      if (!addr) return;

      restoreFromCacheIfAvailable(addr);

      const cooldownEnd = loadRiftCooldown(addr);
      if (cooldownEnd && cooldownEnd > Date.now()) {
        setCooldownEndMs(cooldownEnd);
        const diff = cooldownEnd - Date.now();
        const ratio = 1 - diff / COOLDOWN_MS;
        const initialProgress = Math.min(1, Math.max(0, ratio));
        setDrainValue(1 - initialProgress);
        return;
      }

      setCooldownEndMs(null);
      setDrainValue(1);

      await runGasCalculationWithCache(addr, { isManualRecalc: false });
    },
    [restoreFromCacheIfAvailable, runGasCalculationWithCache]
  );

  useEffect(() => {
    if (!connected || !address) {
      setTxCount(0);
      setTotalSupra(null);
      setAvgSupra(null);
      setMonthlyAvgSupra(null);
      setPagesProcessed(0);
      setProgressPercent(0);
      setHasStats(false);
      setLastSyncTime(null);
      setIsDraining(false);
      setDrainValue(1);
      setManualSyncActive(false);
      setCooldownEndMs(null);
      return;
    }

    if (hasAccess === false) {
      setTxCount(0);
      setTotalSupra(null);
      setAvgSupra(null);
      setMonthlyAvgSupra(null);
      setPagesProcessed(0);
      setProgressPercent(0);
      setHasStats(false);
      setLastSyncTime(null);
      setIsDraining(false);
      setDrainValue(1);
      setManualSyncActive(false);
      setCooldownEndMs(null);
      return;
    }

    if (loadingAccess || loadingBalances) {
      return;
    }

    if (!manualSyncActive) {
      runAccessAndMaybeCalc(address);
    }
  }, [
    connected,
    address,
    hasAccess,
    loadingAccess,
    loadingBalances,
    runAccessAndMaybeCalc,
    manualSyncActive,
  ]);

  useEffect(() => {
    if (!connected || !address) {
      setCooldownEndMs(null);
      setDrainValue(1);
      return;
    }
    const end = loadRiftCooldown(address);
    if (end && end > Date.now()) {
      setCooldownEndMs(end);
      const diff = end - Date.now();
      const ratio = 1 - diff / COOLDOWN_MS;
      const initialProgress = Math.min(1, Math.max(0, ratio));
      setDrainValue(1 - initialProgress);
    } else {
      setCooldownEndMs(null);
      setDrainValue(1);
    }
  }, [connected, address]);

  const now = nowMs;
  const cooldownActive =
    cooldownEndMs != null && cooldownEndMs > now && hasStats;
  const cooldownRemainingMs = cooldownActive ? cooldownEndMs - now : 0;

  let cooldownProgress = 0;
  if (cooldownActive && cooldownRemainingMs > 0) {
    const diff = cooldownEndMs - now;
    const ratio = 1 - diff / COOLDOWN_MS;
    cooldownProgress = Math.min(1, Math.max(0, ratio));
  } else if (hasStats && !cooldownEndMs) {
    cooldownProgress = 1;
  }

  const cooldownRemainingSeconds = cooldownActive
    ? Math.ceil(cooldownRemainingMs / 1000)
    : 0;

  const walletInstalled =
    mounted &&
    typeof window !== "undefined" &&
    "starkey" in window &&
    !!window.starkey?.supra;

  const buttonLabel = !connected
    ? connecting
      ? "Connecting…"
      : walletInstalled
      ? "Connect Starkey Wallet"
      : "Install Starkey Wallet"
    : loadingAccess
    ? "Checking Access…"
    : hasAccess === false
    ? "Access Denied (1,000 $SUPRAWR Needed)"
    : calculating
    ? "Syncing…"
    : hasStats && cooldownActive
    ? `Rift Energy Recharging… ${cooldownRemainingSeconds}s`
    : "Sync Rift Data";

  const isButtonDisabled =
    connecting ||
    calculating ||
    loadingAccess ||
    (connected && hasAccess === false) ||
    (connected && hasAccess && hasStats && cooldownActive);

  const totalSupraUsdDisplay =
    totalSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(totalSupra, supraUsdPrice)
      : null;

  const avgSupraUsdDisplay =
    avgSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(avgSupra, supraUsdPrice)
      : null;

  const monthlySupraDisplay = formatSupraShort(monthlyAvgSupra);
  const monthlyUsdDisplay =
    monthlyAvgSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(monthlyAvgSupra, supraUsdPrice)
      : null;

  const handleSyncClick = useCallback(async () => {
    setError("");

    if (!connected || !address) {
      try {
        setConnecting(true);
        await connect();
      } catch (err) {
        console.error("Connect error:", err);
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (hasAccess === false) {
      setError("You need at least 1,000 $SUPRAWR to run this scan.");
      return;
    }

    if (cooldownActive) {
      return;
    }

    setManualSyncActive(true);
    setCooldownEndMs(null);
    setDrainValue(1);

    await runGasCalculationWithCache(address, { isManualRecalc: true });

    setManualSyncActive(false);
  }, [
    connected,
    address,
    connect,
    hasAccess,
    cooldownActive,
    runGasCalculationWithCache,
  ]);

  const energyBarFill = hasStats
    ? cooldownActive
      ? cooldownProgress
      : 1
    : 0;

  const energyStatusLabel = !connected
    ? "Disconnected"
    : !hasStats
    ? "No data yet"
    : cooldownActive
    ? "Recharging"
    : "Fully charged";

  const energyStatusDetail = !connected
    ? "Connect your Starkey wallet to sync gas stats."
    : !hasStats
    ? "Run your first scan to initialize Rift telemetry."
    : cooldownActive
    ? `Next full scan unlocked in ~${cooldownRemainingSeconds}s.`
    : "Rift energy full. You can run a manual resync when needed.";

  const lastSyncLabel = lastSyncTime
    ? new Date(lastSyncTime).toLocaleString()
    : "No sync recorded yet.";

  const infoModalClass = `modal-001-overlay${
    showInfo ? " modal-001-overlay--visible" : ""
  }${isInfoExiting ? " modal-001-overlay--exiting" : ""}`;

  const effectiveProgress = isDraining
    ? Math.max(0, 100 - drainValue * 100)
    : progressPercent;

  return (
    <>
      <section className="gas-panel-layout">
        <div className="gas-main-column">
          <div className="gas-card gas-card--primary">
            <header className="gas-card-header">
              <div className="gas-card-title-block">
                <h2 className="gas-card-title">
                  // COIN GAS FEE TELEMETRY //
                </h2>
                <p className="gas-card-subtitle">
                  Scan your Supra coin ($SUPRA) transactions and estimate gas
                  fees using on-chain RPC data. This focuses on coin transfers
                  only.
                </p>
              </div>

              <button
                type="button"
                className="info-badge-button"
                onClick={openInfoModal}
              >
                <span className="info-badge-icon">?</span>
                <span className="info-badge-text">How this scan works</span>
              </button>
            </header>

            <div className="gas-card-body">
              <div className="gas-cta-row">
                <button
                  type="button"
                  className="gas-scan-button"
                  onClick={handleSyncClick}
                  disabled={isButtonDisabled}
                >
                  <span className="gas-scan-label">{buttonLabel}</span>
                  <span className="gas-scan-hint">
                    {connected
                      ? "Queries Supra RPC for coin-level gas usage."
                      : "Connect Starkey to start scanning your gas history."}
                  </span>
                </button>

                <div className="gas-status-block">
                  <div className="gas-status-row">
                    <span className="gas-status-label">
                      Last synced:
                    </span>
                    <span className="gas-status-value">
                      {lastSyncLabel}
                    </span>
                  </div>
                  <div className="gas-status-row">
                    <span className="gas-status-label">
                      Access status:
                    </span>
                    <span className="gas-status-value">
                      {!connected
                        ? "No wallet connected."
                        : loadingAccess
                        ? "Checking access…"
                        : hasAccess === false
                        ? "Insufficient $SUPRAWR (1,000 needed)."
                        : "Access granted."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="gas-progress-row">
                <div className="gas-progress-label">
                  Scan progress
                  {pagesProcessed > 0 && (
                    <span className="gas-progress-pages">
                      Pages processed: {pagesProcessed}
                    </span>
                  )}
                </div>
                <div className="gas-progress-bar-outer">
                  <div
                    className="gas-progress-bar-inner"
                    style={{ width: `${effectiveProgress}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="gas-error-banner">
                  <span>{error}</span>
                </div>
              )}

              <div className="gas-metrics-grid">
                <div className="gas-metric">
                  <div className="gas-metric-label">
                    Total gas units (coin tx)
                  </div>
                  <div className="gas-metric-value">
                    {totalSupra ? (
                      <>
                        <span className="gas-metric-number">
                          {totalSupra}
                        </span>
                        <span className="gas-metric-unit">
                          {" "}
                          $SUPRA
                        </span>
                      </>
                    ) : (
                      <span className="gas-metric-placeholder">—</span>
                    )}
                  </div>
                  <div className="gas-metric-sub">
                    {totalSupraUsdDisplay ??
                      "Run a scan to estimate USD value of your gas usage."}
                  </div>
                </div>

                <div className="gas-metric">
                  <div className="gas-metric-label">
                    Avg gas per coin tx
                  </div>
                  <div className="gas-metric-value">
                    {avgSupra ? (
                      <>
                        <span className="gas-metric-number">
                          {avgSupra}
                        </span>
                        <span className="gas-metric-unit">
                          {" "}
                          $SUPRA
                        </span>
                      </>
                    ) : (
                      <span className="gas-metric-placeholder">—</span>
                    )}
                  </div>
                  <div className="gas-metric-sub">
                    {avgSupraUsdDisplay ??
                      "Estimated average gas paid for each coin transfer."}
                  </div>
                </div>

                <div className="gas-metric">
                  <div className="gas-metric-label">
                    Estimated gas spent per month
                  </div>
                  <div className="gas-metric-value">
                    {monthlySupraDisplay ? (
                      <>
                        <span className="gas-metric-number">
                          {monthlySupraDisplay}
                        </span>
                        <span className="gas-metric-unit">
                          {" "}
                          $SUPRA
                        </span>
                      </>
                    ) : (
                      <span className="gas-metric-placeholder">—</span>
                    )}
                  </div>
                  <div className="gas-metric-sub">
                    {monthlyUsdDisplay ??
                      "Approximate monthly gas spend based on your activity window."}
                  </div>
                </div>

                <div className="gas-metric">
                  <div className="gas-metric-label">
                    Coin transaction sample size
                  </div>
                  <div className="gas-metric-value">
                    {txCount > 0 ? (
                      <>
                        <span className="gas-metric-number">
                          {txCount}
                        </span>
                        <span className="gas-metric-unit"> tx</span>
                      </>
                    ) : (
                      <span className="gas-metric-placeholder">—</span>
                    )}
                  </div>
                  <div className="gas-metric-sub">
                    Based on recent coin transactions from Supra RPC (v2).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="gas-side-column">
          <div className="gas-card gas-card--side">
            <header className="gas-card-header">
              <div className="gas-card-title-block">
                <h3 className="gas-card-title">// RIFT ENERGY METER //</h3>
                <p className="gas-card-subtitle">
                  Each full scan stresses the Rift. As timers expire, the
                  energy rebuilds and you can safely pull another history
                  slice.
                </p>
              </div>
            </header>
            <div className="gas-card-body">
              <div className="rift-energy-wrapper">
                <div className="rift-energy-label-row">
                  <span className="rift-energy-label">Rift charge</span>
                  <span className="rift-energy-percent">
                    {Math.round(energyBarFill * 100)}%
                  </span>
                </div>

                <div className="rift-energy-bar-outer">
                  <div
                    className={`rift-energy-bar-inner${
                      !hasStats
                        ? " rift-energy-bar-inner--empty"
                        : cooldownActive
                        ? " rift-energy-bar-inner--cooldown"
                        : " rift-energy-bar-inner--full"
                    }`}
                    style={{ width: `${Math.round(energyBarFill * 100)}%` }}
                  />
                </div>

                <div className="rift-energy-status-row">
                  <span className="rift-energy-status-label">
                    {energyStatusLabel}
                  </span>
                  <span className="rift-energy-status-detail">
                    {energyStatusDetail}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="gas-card gas-card--side">
            <header className="gas-card-header">
              <div className="gas-card-title-block">
                <h3 className="gas-card-title">// LIMITATIONS //</h3>
              </div>
            </header>
            <div className="gas-card-body">
              <ul className="gas-limitations-list">
                <li>
                  Only <strong>coin ($SUPRA) transactions</strong> are
                  included for now.
                </li>
                <li>
                  Contract-only actions, NFT mints, DEX swaps, and other
                  system-level fees may not appear until Supra exposes richer
                  RPC methods.
                </li>
                <li>
                  This console is a{" "}
                  <strong>community experiment, not an official explorer</strong>
                  .
                </li>
                <li>
                  Future versions will add <strong>historical charts</strong>,{" "}
                  <strong>gas spikes</strong>, and{" "}
                  <strong>per-dApp breakdowns</strong> when reliable data
                  sources are available.
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </section>

      {showInfo || isInfoExiting ? (
        <div className={infoModalClass} onClick={closeInfoModal}>
          <div
            className="modal-001-container"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-001-header">
              <div className="modal-001-title-block">
                <h2 className="modal-001-title">
                  // COIN GAS FEE TELEMETRY DETAILS //
                </h2>
              </div>
              <button
                type="button"
                className="modal-001-close"
                onClick={closeInfoModal}
              >
                ×
              </button>
            </header>

            <div className="modal-001-body gas-info-body">
              <p>
                This module queries Supra’s{" "}
                <code>/rpc/v2/accounts/:address/coin_transactions</code>{" "}
                endpoint and computes gas usage across recent{" "}
                <strong>coin ($SUPRA) transfers</strong>.
              </p>
              <p>
                Gas cost is currently derived from{" "}
                <code>gas_unit_price × max_gas_amount</code> in transaction
                headers. As Supra’s RPC matures, this may be replaced with
                more precise fee fields once they are available for all
                transaction types.
              </p>
              <p>
                Today, there is{" "}
                <strong>
                  no unified public RPC method to compute gas across all
                  transaction categories
                </strong>
                . The only place that fully accurate gas data exists is inside
                complete transaction details, which Supra’s public RPC does not
                yet expose via a general “fetch by hash” endpoint.
              </p>
              <p>
                As those capabilities come online, Dino Dash will expand beyond
                coin transfers to cover{" "}
                <strong>DEX trades, NFT mints, contracts, and more</strong>.
              </p>
              <p>
                Until then, treat this as a{" "}
                <strong>best-effort telemetry console</strong> for understanding
                your gas footprint — not a canonical tax or accounting tool.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
