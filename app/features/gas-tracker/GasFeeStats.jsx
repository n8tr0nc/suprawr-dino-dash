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

function formatApproxSupraDisplay(raw) {
  if (raw == null) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;

  const abs = Math.abs(num);

  // Millions: ~X.XXM
  if (abs >= 1_000_000) {
    const val = num / 1_000_000;
    const rounded = Math.round(val * 100) / 100;
    return `~${rounded.toFixed(2)}M`;
  }

  // Thousands: ~X.XK
  if (abs >= 1_000) {
    const val = num / 1_000;
    const rounded = Math.round(val * 10) / 10;
    return `~${rounded.toFixed(1)}K`;
  }

  // Small values: ~X.XX
  const roundedSmall = Math.round(num * 100) / 100;
  return `~${roundedSmall.toFixed(2)}`;
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

// -------------------- HOLDER RANK LOGIC (kept for future use) --------------------

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

  if (whole >= 10_000_000n) return "Master";
  if (whole >= 1_000_000n) return "Titan";
  if (whole >= 100_000n) return "Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  return "Hatchling";
}

// -------------------- TIMESTAMP HELPERS (used in full sync) --------------------

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
      const header = tx.header;
      if (!header) continue;

      const price = BigInt(header.gas_unit_price ?? 0);
      const maxGas = BigInt(header.max_gas_amount ?? 0);

      if (price > 0n && maxGas > 0n) {
        totalUnits += price * maxGas;
      }

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

  return { totalTx, totalSupra, avgSupra, monthlyAvgSupra, latestTxTimestampMs };
}

// -------------------- LOCAL CACHE HELPERS --------------------

const GAS_CACHE_PREFIX = "suprawr_gas_cache_v1:";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours TTL (currently not enforced, but kept for future use)

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
    // ignore storage failures
  }
}

// -------------------- RIFT ENERGY COOLDOWN HELPERS --------------------

const COOLDOWN_MS = 60_000;
const RIFT_COOLDOWN_PREFIX = "suprawr_rift_cd_v1:";

function getRiftCooldownKey(address) {
  if (!address) return null;
  return `${RIFT_COOLDOWN_PREFIX}${address.toLowerCase()}`;
}

function loadRiftCooldown(address) {
  if (typeof window === "undefined") return null;
  const key = getRiftCooldownKey(address);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
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
  // NEW: split wallet + stats
  const { connected, address, connect } = useWallet();
  const { hasAccess, supraUsdPrice, loadingAccess, loadingBalances } =
    useStats();

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

  // Rift Energy animation state (0 → 1) for charge-up
  const [energyAnim, setEnergyAnim] = useState(0);

  // Rift Energy drain state (1 → 0) when sync starts
  const [isDraining, setIsDraining] = useState(false);
  const [drainValue, setDrainValue] = useState(1);

  // Track when a manual recalc is in-flight, so we can keep bar empty
  const [manualSyncActive, setManualSyncActive] = useState(false);

  // Rift Energy cooldown state
  const [cooldownEndMs, setCooldownEndMs] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  // Have we successfully loaded stats (from cache or fresh sync)?
  const [hasStats, setHasStats] = useState(false);

  // run id to cancel in-flight calculations on wallet change
  const calcRunIdRef = useRef(0);

  // Drain sound refs
  const drainAudioRef = useRef(null);
  const drainSoundPlayedRef = useRef(false);

  const handleOpenInfo = useCallback(() => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }

    setIsInfoExiting(false);
    setShowInfo(true);
  }, []);

  const handleCloseInfo = useCallback(() => {
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

  const startRiftCooldown = useCallback((addr) => {
    if (!addr) return;
    const end = Date.now() + COOLDOWN_MS;
    setCooldownEndMs(end);
    saveRiftCooldown(addr, end);
  }, []);

  // Core calculation + cache writer
  const runGasCalculationWithCache = useCallback(
    async (addr, options = {}) => {
      if (!addr) return;
      const { isManualRecalc = false } = options;

      const runId = ++calcRunIdRef.current;

      try {
        setCalculating(true);
        setError("");
        setPagesProcessed(0);
        setProgressPercent(5);

        const {
          totalTx,
          totalSupra,
          avgSupra,
          monthlyAvgSupra,
          latestTxTimestampMs,
        } = await fetchLifetimeGasStats(addr, 100, 5000, ({ page }) => {
          if (calcRunIdRef.current !== runId) return;
          setPagesProcessed(page);
          setProgressPercent((prev) => {
            const next = prev + 4;
            return next >= 95 ? 95 : next;
          });
        });

        if (calcRunIdRef.current !== runId) {
          return;
        }

        setPagesProcessed((prev) => (prev === 0 ? 1 : prev));
        setProgressPercent(100);
        await new Promise((resolve) => setTimeout(resolve, 250));

        setTxCount(totalTx);
        setTotalSupra(totalSupra);
        setAvgSupra(avgSupra);
        setMonthlyAvgSupra(monthlyAvgSupra);
        setHasStats(true);
        const syncTime = latestTxTimestampMs || Date.now();
        setLastSyncTime(syncTime);

        saveGasCache(addr, {
          totalTx,
          totalSupra,
          avgSupra,
          monthlyAvgSupra,
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
        setCalculating(false);
        setIsDraining(false);
        setManualSyncActive(false); // allow cooldown to take over
      }
    },
    [startRiftCooldown]
  );

  // Load existing cache + maybe auto-refresh if stale
  const runAccessAndMaybeCalc = useCallback(
    async (addr) => {
      if (!addr) return;
      setError("");

      // Wait for gate result; if no access, do nothing
      if (hasAccess === false) return;
      if (hasAccess == null) return;

      const cache = loadGasCache(addr);

      // No cache yet → first-time sync runs automatically
      if (!cache) {
        await runGasCalculationWithCache(addr, { isManualRecalc: false });
        return;
      }

      // Cache exists → always trust it and load instantly
      const updatedAtMs =
        typeof cache.updatedAtMs === "number" ? cache.updatedAtMs : 0;

      setTxCount(cache.totalTx || 0);
      setTotalSupra(cache.totalSupra || null);
      setAvgSupra(cache.avgSupra || null);
      setMonthlyAvgSupra(cache.monthlyAvgSupra || null);
      setLastSyncTime(
        cache.lastSyncTime != null ? cache.lastSyncTime : updatedAtMs || null
      );
      setPagesProcessed(0);
      setProgressPercent(0);
      setHasStats(true);
    },
    [hasAccess, runGasCalculationWithCache]
  );

  // Auto-run when wallet + access are ready
  useEffect(() => {
    if (!connected || !address) {
      // Reset when disconnected
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

      // HARD-STOP any drain audio on disconnect
      const a = drainAudioRef.current;
      if (a) {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          // ignore
        }
      }
      drainSoundPlayedRef.current = false;

      return;
    }

    // Wait until access tier is known
    if (hasAccess === null) return;
    if (hasAccess === false) return;

    runAccessAndMaybeCalc(address);
  }, [connected, address, hasAccess, runAccessAndMaybeCalc]);

  // Load Rift cooldown when address changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!address) {
      setCooldownEndMs(null);
      return;
    }

    const stored = loadRiftCooldown(address);
    if (!stored) {
      setCooldownEndMs(null);
      return;
    }

    if (stored <= Date.now()) {
      setCooldownEndMs(null);
    } else {
      setCooldownEndMs(stored);
    }
  }, [address]);

  // Drive cooldown timer (Rift Energy bar)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cooldownEndMs) return;

    setNowMs(Date.now());

    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);

    return () => {
      window.clearInterval(id);
    };
  }, [cooldownEndMs]);

  // Animate Rift Energy when wallet is connected, has an address, and is NOT cooling down
  useEffect(() => {
    if (!connected || !address) {
      setEnergyAnim(0);
      return;
    }

    // If cooldown is active → do NOT animate or reset, just hold
    if (cooldownEndMs && cooldownEndMs > Date.now()) {
      return;
    }

    let rafId;
    const duration = 400; // ms, quick charge-up

    setEnergyAnim(0);

    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration); // 0 → 1
      setEnergyAnim(t);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [connected, address, cooldownEndMs]);

  // Init drain sound audio once on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (drainAudioRef.current) return;

    const audio = new Audio("/audio/drain-003.mp3");
    audio.loop = false;
    audio.volume = 0.4;
    drainAudioRef.current = audio;
  }, []);

  // Drain animation: 1 → 0 over ~3s when manual sync starts
  useEffect(() => {
    if (!isDraining) return;

    let rafId;
    const duration = 3000; // 3 seconds

    setDrainValue(1);
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration); // 0 → 1
      const v = 1 - t; // 1 → 0
      setDrainValue(v);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDrainValue(0);
        setIsDraining(false);
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isDraining]);

  // Play drain sound once when drain actually starts
  useEffect(() => {
    if (!isDraining) {
      drainSoundPlayedRef.current = false;
      return;
    }

    if (drainSoundPlayedRef.current) return;
    const audio = drainAudioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // cosmetic only
    }
    drainSoundPlayedRef.current = true;
  }, [isDraining]);

  // Clean up info modal timer + drain audio on unmount
  useEffect(() => {
    return () => {
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
      }
      const a = drainAudioRef.current;
      if (a) {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleAction = useCallback(async () => {
    setError("");

    // Not connected → use wallet connect
    if (!connected) {
      try {
        setConnecting(true);
        await connect();
      } catch (err) {
        console.error("GasFeeStats connect failed:", err);
        setError("Failed to connect Starkey wallet.");
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (!address) {
      setError("No wallet address available. Please connect again.");
      return;
    }

    if (hasAccess === false) {
      return;
    }

    const isManualRecalc = !!hasStats;

    if (isManualRecalc) {
      setManualSyncActive(true);
      setIsDraining(true);
      setDrainValue(1);
    }

    await runGasCalculationWithCache(address, { isManualRecalc });
  }, [connected, address, hasAccess, hasStats, connect, runGasCalculationWithCache]);

  // --- Rift cooldown derived values ---
  let cooldownActive = false;
  let cooldownRemainingMs = 0;
  let cooldownProgress = 0;

  if (cooldownEndMs) {
    const diff = cooldownEndMs - nowMs;
    if (diff > 0) {
      cooldownActive = true;
      cooldownRemainingMs = diff;
      const ratio = 1 - diff / COOLDOWN_MS;
      cooldownProgress = Math.min(1, Math.max(0, ratio));
    } else {
      cooldownActive = false;
      cooldownProgress = 1;
    }
  }

  const cooldownRemainingSeconds = cooldownActive
    ? Math.ceil(cooldownRemainingMs / 1000)
    : 0;

  // Detect if Starkey is installed (SSR-safe)
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

  const monthlyAvgUsdDisplay =
    monthlyAvgSupra && supraUsdPrice != null
      ? formatUsdApproxFromSupraString(monthlyAvgSupra, supraUsdPrice)
      : null;

  // --- Progress bar derived display ---
  let displayProgressPercent = 0;
  let progressLabelText = "No sync run yet.";

  if (calculating) {
    displayProgressPercent = Math.min(
      100,
      Math.max(0, progressPercent || 5)
    );
    progressLabelText = `Syncing txs... Pages processed: ${pagesProcessed}`;
  } else if (hasStats) {
    displayProgressPercent = 100;
    progressLabelText = "Last sync complete";
  } else {
    displayProgressPercent = 0;
    progressLabelText = "No sync run yet";
  }

  // --- Rift Energy bar display ---
  let energyProgress = 0;

  if (!connected || !address) {
    energyProgress = 0;
  } else if (isDraining) {
    energyProgress = Math.max(0, Math.min(1, drainValue));
  } else if (manualSyncActive && calculating) {
    energyProgress = 0;
  } else if (cooldownActive) {
    energyProgress = cooldownProgress;
  } else {
    energyProgress = Math.min(1, Math.max(0, energyAnim));
  }

  let riftStatusLabel;
  if (!connected || !address) {
    riftStatusLabel = "Connect to charge";
  } else if (isDraining) {
    riftStatusLabel = drainValue <= 0.01 ? "Empty" : "Draining…";
  } else if (manualSyncActive && calculating) {
    riftStatusLabel = "Empty";
  } else if (cooldownActive) {
    riftStatusLabel = `Recharging… ${cooldownRemainingSeconds}s`;
  } else if (hasAccess && hasStats) {
    riftStatusLabel = "Full";
  } else if (hasAccess) {
    riftStatusLabel = "Ready to run first sync";
  } else {
    riftStatusLabel = "Full";
  }

  const formattedTxCount =
    typeof txCount === "number" && txCount.toLocaleString
      ? txCount.toLocaleString()
      : txCount;

  let totalSupraDisplay = "No data";
  if (hasStats && totalSupra) {
    const approxTotalSupra = formatApproxSupraDisplay(totalSupra);
    totalSupraDisplay = `${approxTotalSupra} $SUPRA`;
    if (totalSupraUsdDisplay) {
      totalSupraDisplay += ` (~$${totalSupraUsdDisplay})`;
    }
  }

  let avgSupraDisplay = "No data";
  if (hasStats && avgSupra) {
    const approxAvgSupra = formatApproxSupraDisplay(avgSupra);
    avgSupraDisplay = `${approxAvgSupra} $SUPRA`;
    if (avgSupraUsdDisplay) {
      avgSupraDisplay += ` (~$${avgSupraUsdDisplay})`;
    }
  }

  let monthlySupraDisplay = "No data";
  if (hasStats && monthlyAvgSupra) {
    const approxMonthlySupra = formatApproxSupraDisplay(
      monthlyAvgSupra
    );
    monthlySupraDisplay = `${approxMonthlySupra} $SUPRA`;
    if (monthlyAvgUsdDisplay) {
      monthlySupraDisplay += ` (~$${monthlyAvgUsdDisplay})`;
    }
  }

  const isEnergyFull =
    !cooldownActive &&
    !isDraining &&
    !manualSyncActive &&
    energyProgress >= 0.999;
  const riftBarClassName = `rift-energy-bar${
    isEnergyFull ? " rift-energy-bar--full" : ""
  }`;

  const isProgressFull =
    !calculating && hasStats && displayProgressPercent >= 100;
  const progressBarClassName = `progress-bar${
    isProgressFull ? " progress-bar--full" : ""
  }`;

  function formatTimestamp(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    );
  }

  const lastSyncLabel =
    progressLabelText === "Last sync complete" && lastSyncTime
      ? `${progressLabelText} – ${formatTimestamp(lastSyncTime)}`
      : progressLabelText;

  const accessError =
    connected && hasAccess === false
      ? "Access denied: this wallet must hold at least 1,000 $SUPRAWR to use this tool."
      : "";

  return (
    <>
      <section className="gas-card">
        <div className="dashboard-panel-header">
          <button
            className="gas-info-button"
            onClick={handleOpenInfo}
            aria-label="Gas Tracker Info"
          >
            i
          </button>

          <span className="dashboard-panel-pill">
            Powered by Supra RPC & Rift Energy
          </span>
        </div>

        {showInfo && (
          <div
            className={`modal-001-overlay gas-info-overlay${
              isInfoExiting ? " modal-001-overlay--exiting" : ""
            }`}
            onClick={handleCloseInfo}
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
                  onClick={handleCloseInfo}
                >
                  ×
                </button>
              </div>

              <div className="modal-001-body gas-info-body">
                <p>
                  This tool tracks gas spent on{" "}
                  <strong>SUPRA coin transactions only</strong> for your
                  connected wallet, using Supra’s public RPC.
                </p>
                <p>
                  It works through the <code>coin_transactions</code>{" "}
                  endpoint, which is the only RPC endpoint that includes
                  gas usage details.{" "}
                  <strong>
                    The only place full gas-fee data exists is inside the
                    complete transaction detail, which Supra RPC
                    currently does not expose through any public “fetch by
                    hash” endpoint.
                  </strong>{" "}
                  Because of this,{" "}
                  <strong>
                    contract calls, burns, swaps, NFTs, and other
                    non-coin actions cannot be included.
                  </strong>
                </p>
                <p>
                  <strong>
                    There is currently no way to compute a wallet’s
                    total gas fees across ALL transaction types using
                    only the public Supra RPC.
                  </strong>
                </p>
                <p>
                  To improve performance, the tool{" "}
                  <strong>
                    automatically syncs and calculates when you connect
                    your wallet
                  </strong>
                  , then <strong>caches results for 24 hours</strong>.
                  Reconnecting within that window shows cached values
                  instantly. After 24 hours, a fresh sync runs
                  automatically. You can also manually force a new sync
                  using <strong>Sync Rift Data</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="field-block">
          <label htmlFor="wallet" className="field-label">
            Connected Supra Wallet
          </label>
          <input
            id="wallet"
            type="text"
            className="field-input"
            value={address || ""}
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

        {/* Rift Energy Recharge bar – always visible */}
        <div className="rift-energy-wrapper">
          <div className="rift-energy-header">
            <span className="rift-energy-title">Rift Energy</span>
            <span className="rift-energy-status">{riftStatusLabel}</span>
          </div>
          <div className={riftBarClassName}>
            <div
              className="rift-energy-bar-fill"
              style={{
                width: `${Math.round(energyProgress * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Rift Sync bar – always visible */}
        <div className="progress-wrapper">
          <div className="progress-header">
            <span className="progress-title">Rift Sync</span>
            <span className="progress-status">{lastSyncLabel}</span>
          </div>

          <div className={progressBarClassName}>
            <div
              className="progress-bar-fill"
              style={{ width: `${displayProgressPercent}%` }}
            />
          </div>
        </div>

        {accessError && <div className="alert error">{accessError}</div>}
        {error && <div className="alert error">{error}</div>}

        {connected && hasAccess && !error && (
          <div className="results">
            <div className="result-row">
              <span className="result-label">$SUPRA txs synced</span>
              <span className="result-value">
                {hasStats ? formattedTxCount : "No data"}
              </span>
            </div>

            <div className="result-row">
              <span className="result-label">
                Estimated gas spent on $SUPRA txs
              </span>
              <span className="result-value">{totalSupraDisplay}</span>
            </div>

            <div className="result-row">
              <span className="result-label">
                Average estimated gas per $SUPRA tx
              </span>
              <span className="result-value">{avgSupraDisplay}</span>
            </div>

            <div className="result-row">
              <span className="result-label">
                Estimated gas spent per month
              </span>
              <span className="result-value">{monthlySupraDisplay}</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
