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
const INFO_MODAL_ANIM_MS = 500;

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

  if (abs >= 1_000_000) {
    const val = num / 1_000_000;
    const rounded = Math.round(val * 100) / 100;
    return `~${rounded.toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    const val = num / 1_000;
    const rounded = Math.round(val * 10) / 10;
    return `~${rounded.toFixed(1)}K`;
  }

  const roundedSmall = Math.round(num * 100) / 100;
  return `~${roundedSmall.toFixed(2)}`;
}

// -------------------- MATRIX EFFECT HELPERS (NEW) --------------------

function randomDigitsMatching(str) {
  if (!str) return "";

  let out = "";

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (/\d/.test(ch)) {
      out += Math.floor(Math.random() * 10).toString();
    } else if (["M", "K", "~", ".", "$"].includes(ch)) {
      out += ch;
    } else if (ch === " ") {
      out += " ";
    } else {
      out += Math.floor(Math.random() * 10).toString();
    }
  }

  return out;
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

// -------------------- TIMESTAMP HELPERS --------------------

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

  const objs = [header, tx];
  for (const obj of objs) {
    if (!obj || typeof obj !== "object") continue;

    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase().includes("time")) {
        const parsed = parseTimestampValue(val);
        if (parsed != null) return parsed;
      }
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

    const url = `${RPC_BASE_URL}/rpc/v2/accounts/${address}/coin_transactions?${params}`;
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
      onPage({ page: page + 1, totalTx, batchSize: records.length });
    }

    const nextCursor = data?.cursor;
    if (nextCursor == null) break;

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

    if (earliestTs && latestTs && latestTs > earliestTs) {
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
  };
}
// -------------------- LOCAL CACHE HELPERS --------------------

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
  } catch {}
}

// -------------------- COOLDOWN HELPERS --------------------

const COOLDOWN_MS = 30_000;
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
  } catch {}
}

function clearRiftCooldown(address) {
  if (typeof window === "undefined") return;
  const key = getRiftCooldownKey(address);
  if (!key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {}
}

// -------------------- MAIN COMPONENT --------------------

export default function GasFeeStats({ isSfxMuted }) {
  const { connected, address, connect } = useWallet();
  const { hasAccess, supraUsdPrice, loadingAccess, loadingBalances } =
    useStats();

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

  const [energyAnim, setEnergyAnim] = useState(0);

  const [isDraining, setIsDraining] = useState(false);
  const [drainValue, setDrainValue] = useState(1);

  const [manualSyncActive, setManualSyncActive] = useState(false);

  const [cooldownEndMs, setCooldownEndMs] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const [hasStats, setHasStats] = useState(false);

  const calcRunIdRef = useRef(0);

  const drainAudioRef = useRef(null);
  const drainSoundPlayedRef = useRef(false);

  const scanAudioRef = useRef(null);

  const chargeAudioRef = useRef(null);

  // Modal open / close SFX
  const modalAudioRef = useRef(null);
  const modalCloseAudioRef = useRef(null);

  // RAF refs for draining + energy charge loops
  const drainRafRef = useRef(null);
  const energyRafRef = useRef(null);

  // Track last known address so disconnect cleanup can clear persisted cooldown
  const lastAddrRef = useRef(null);

  // Track cooldown interval so we can hard-stop it on disconnect
  const cooldownIntervalRef = useRef(null);

  // -------------------------------
  // NEW: MATRIX EFFECT STATE
  // -------------------------------
  const [matrixTx, setMatrixTx] = useState("");
  const [matrixTotal, setMatrixTotal] = useState("");
  const [matrixAvg, setMatrixAvg] = useState("");
  const [matrixMonthly, setMatrixMonthly] = useState("");

  // -------------------------------
  // MATRIX EFFECT INTERVAL (50ms)
  // -------------------------------
  useEffect(() => {
    if (!calculating) {
      setMatrixTx("");
      setMatrixTotal("");
      setMatrixAvg("");
      setMatrixMonthly("");
      return;
    }

    const id = setInterval(() => {
      setMatrixTx((prev) => randomDigitsMatching(prev || "000000000"));
      setMatrixTotal((prev) => randomDigitsMatching(prev || "000000000"));
      setMatrixAvg((prev) => randomDigitsMatching(prev || "000000000"));
      setMatrixMonthly((prev) => randomDigitsMatching(prev || "000000000"));
    }, 50);

    return () => clearInterval(id);
  }, [calculating]);

  // -------------------------------
  // INFO MODAL OPEN/CLOSE
  // -------------------------------

  const handleOpenInfo = useCallback(() => {
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }

    // Play modal open SFX (volume is controlled by SFX mute effect)
    const audio = modalAudioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {}
    }

    setIsInfoExiting(false);
    setShowInfo(true);
  }, []);

  const handleCloseInfo = useCallback(() => {
    if (!showInfo) return;

    const audio = modalCloseAudioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {}
    }

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

  // -------------------------------
  // RIFT COOLDOWN TRIGGER
  // -------------------------------

  const startRiftCooldown = useCallback(
    (addr) => {
      if (!addr) return;
      const end = Date.now() + COOLDOWN_MS;
      setCooldownEndMs(end);
      saveRiftCooldown(addr, end);

      // 🔊 Play charge sound ONCE when recharge begins
      const audio = chargeAudioRef.current;
      if (audio && !isSfxMuted) {
        try {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch {}
      }
    },
    [isSfxMuted]
  );

  // -------------------------------
  // GAS CALC + CACHE
  // -------------------------------
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

        if (calcRunIdRef.current !== runId) return;

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
        setError("Unable to fetch full coin transaction history from Supra RPC.");
        setProgressPercent(0);
        setPagesProcessed(0);
      } finally {
        setCalculating(false);
        // Scan is finished; manual sync phase is over.
        setManualSyncActive(false);
      }
    },
    [startRiftCooldown]
  );

    // -------------------------------
  // AUTO-LOAD CACHE ONLY (NO AUTO SCAN)
  // -------------------------------

  const runAccessAndMaybeCalc = useCallback(
    async (addr) => {
      if (!addr) return;
      setError("");

      const cache = loadGasCache(addr);

      if (cache) {
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
      } else {
        // No cache yet → clear stats and show placeholders ("Sync for data")
        setTxCount(0);
        setTotalSupra(null);
        setAvgSupra(null);
        setMonthlyAvgSupra(null);
        setLastSyncTime(null);
        setPagesProcessed(0);
        setProgressPercent(0);
        setHasStats(false);
      }
    },
    []
  );

  // -------------------------------
  // REACT TO CONNECTION (CACHE ONLY)
  // -------------------------------

  useEffect(() => {
  if (!connected || !address) {
  //
  // RESET ALL GAS DATA
  //
  setTxCount(0);
  setTotalSupra(null);
  setAvgSupra(null);
  setMonthlyAvgSupra(null);
  setPagesProcessed(0);
  setProgressPercent(0);
  setHasStats(false);
  setLastSyncTime(null);

  //
  // STOP ALL STATES & PROCESSES
  //
  setIsDraining(false);
  setDrainValue(1);
  setManualSyncActive(false);
  setCalculating(false);
  setCooldownEndMs(null);
setNowMs(Date.now()); // forces cooldown to clear
setEnergyAnim(0);     // kill any in-progress charge animation state

// Hard-stop cooldown interval immediately
if (cooldownIntervalRef.current) {
  clearInterval(cooldownIntervalRef.current);
  cooldownIntervalRef.current = null;
}

// Clear persisted cooldown so recharge cannot resume on reconnect
if (lastAddrRef.current) {
  clearRiftCooldown(lastAddrRef.current);
}


  //
  // KILL TIMERS
  //
  if (infoTimerRef.current) {
    clearTimeout(infoTimerRef.current);
    infoTimerRef.current = null;
  }

  //
  // CANCEL ANY ACTIVE RAF LOOPS
  //
  if (drainRafRef.current) {
    cancelAnimationFrame(drainRafRef.current);
    drainRafRef.current = null;
  }
  if (energyRafRef.current) {
    cancelAnimationFrame(energyRafRef.current);
    energyRafRef.current = null;
  }

  //
  // STOP SCAN PROCESS LOOP SAFELY
  //
  calcRunIdRef.current += 1; 
  // This invalidates all in-flight async calculations instantly.

  //
  // STOP ALL SOUND
  //
  const drainA = drainAudioRef.current;
  if (drainA) {
    try {
      drainA.pause();
      drainA.currentTime = 0;
    } catch {}
  }
  drainSoundPlayedRef.current = false;

  const scanA = scanAudioRef.current;
  if (scanA) {
    try {
      scanA.pause();
      scanA.currentTime = 0;
    } catch {}
  }

  const chargeA = chargeAudioRef.current;
  if (chargeA) {
    try {
      chargeA.pause();
      chargeA.currentTime = 0;
    } catch {}
  }

  return;
}

    // On connect, ONLY load cached gas stats (if any).
    // No automatic full scan; user must click Sync.
    runAccessAndMaybeCalc(address);
  }, [connected, address, runAccessAndMaybeCalc]);

  // -------------------------------
  // LOAD RIFT COOLDOWN ON ADDRESS CHANGE
  // -------------------------------

  useEffect(() => {
  if (typeof window === "undefined") return;

    if (!address) {
      setCooldownEndMs(null);
      return;
    }

    lastAddrRef.current = address;

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

  // -------------------------------
  // DRIVE COOLDOWN TIMER
  // -------------------------------

  useEffect(() => {
  if (typeof window === "undefined") return;

  // Hard stop any previous interval
  if (cooldownIntervalRef.current) {
    window.clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = null;
  }

  if (!cooldownEndMs) return;

  setNowMs(Date.now());

  const id = window.setInterval(() => {
    setNowMs(Date.now());
  }, 500);

  cooldownIntervalRef.current = id;

  return () => {
    if (cooldownIntervalRef.current) {
      window.clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  };
}, [cooldownEndMs]);

  // -------------------------------
  // ENERGY CHARGE ANIMATION (VISUAL ONLY)
  // -------------------------------

  useEffect(() => {
    if (!connected || !address) {
      setEnergyAnim(0);
      return;
    }

    // Don't run charge animation while draining, during manual sync, or in cooldown
    if (isDraining || (manualSyncActive && calculating)) return;
    if (cooldownEndMs && cooldownEndMs > Date.now()) return;

    let rafId;
    energyRafRef.current = null;
    const duration = 400;

    setEnergyAnim(0);
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setEnergyAnim(t);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
        energyRafRef.current = rafId;
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (energyRafRef.current) {
        cancelAnimationFrame(energyRafRef.current);
        energyRafRef.current = null;
      }
    };
  }, [connected, address, cooldownEndMs, isDraining, manualSyncActive, calculating]);

  // -------------------------------
  // INIT MODAL SOUNDS
  // -------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!modalAudioRef.current) {
      const openAudio = new Audio("/audio/modal-001.mp3");
      openAudio.loop = false;
      openAudio.volume = 0.35;
      modalAudioRef.current = openAudio;
    }

    if (!modalCloseAudioRef.current) {
      const closeAudio = new Audio("/audio/modal-002.mp3");
      closeAudio.loop = false;
      closeAudio.volume = 0.35;
      modalCloseAudioRef.current = closeAudio;
    }

    return () => {
      [modalAudioRef.current, modalCloseAudioRef.current].forEach((a) => {
        if (!a) return;
        try {
          a.pause();
          a.currentTime = 0;
        } catch {}
      });
      modalAudioRef.current = null;
      modalCloseAudioRef.current = null;
    };
  }, []);

  // Keep modal sound “running muted” behavior consistent with other SFX
  useEffect(() => {
    const openA = modalAudioRef.current;
    const closeA = modalCloseAudioRef.current;

    if (openA) openA.volume = isSfxMuted ? 0 : 0.35;
    if (closeA) closeA.volume = isSfxMuted ? 0 : 0.35;
  }, [isSfxMuted]);

  const playModalOpenSfx = useCallback(() => {
    const audio = modalAudioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  // -------------------------------
  // INIT DRAIN SOUND
  // -------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (drainAudioRef.current) return;

    const audio = new Audio("/audio/drain-005.mp3");
    audio.loop = false;
    audio.volume = 0.4;
    drainAudioRef.current = audio;
  }, []);

  // -------------------------------
  // INIT SCAN SOUND
  // -------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (scanAudioRef.current) return;

    const audio = new Audio("/audio/scan-010.mp3");
    audio.loop = true;
    audio.volume = 0.2;
    scanAudioRef.current = audio;
  }, []);

  // INIT CHARGE SOUND
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chargeAudioRef.current) return;

    const audio = new Audio("/audio/charge-006.mp3");
    audio.loop = false;
    audio.volume = 0.2;
    chargeAudioRef.current = audio;
  }, []);


  // -------------------------------
  // DRAIN ANIMATION (1 → 0 over 3s)
  // -------------------------------

  useEffect(() => {
    if (!isDraining) return;

    let rafId;
    drainRafRef.current = null;
    const duration = 3000;

    setDrainValue(1);
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const v = 1 - t;
      setDrainValue(v);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
        drainRafRef.current = rafId;
      } else {
        // Drain completes; keep manualSyncActive true while scan is still running.
        setDrainValue(0);
        setIsDraining(false);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (drainRafRef.current) {
        cancelAnimationFrame(drainRafRef.current);
        drainRafRef.current = null;
      }
    };
  }, [isDraining]);

  // -------------------------------
  // DRAIN SOUND (plays once per drain)
  // -------------------------------

  useEffect(() => {
    if (!isDraining) {
      drainSoundPlayedRef.current = false;
      return;
    }

    const audio = drainAudioRef.current;
    if (!audio) return;

    // Only start the sound once per drain cycle
    if (drainSoundPlayedRef.current) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}

    drainSoundPlayedRef.current = true;
  }, [isDraining]);

  // -------------------------------
  // DRAIN VOLUME – respond to SFX mute
  // -------------------------------

  useEffect(() => {
    const audio = drainAudioRef.current;
    if (!audio) return;

    // Mute = volume 0, but keep playback running so it can resume mid-sound
    audio.volume = isSfxMuted ? 0 : 0.4;
  }, [isSfxMuted]);

  // -------------------------------
  // SCAN SOUND (loop while calculating)
  // -------------------------------

  useEffect(() => {
    const audio = scanAudioRef.current;
    if (!audio) return;

    const shouldStop = !calculating || !connected || !address;

    if (shouldStop) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      return;
    }

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    };
  }, [calculating, connected, address]);

  // -------------------------------
  // SCAN VOLUME – respond to SFX mute
  // -------------------------------

  useEffect(() => {
    const audio = scanAudioRef.current;
    if (!audio) return;

    audio.volume = isSfxMuted ? 0 : 0.2;
  }, [isSfxMuted]);

  // -------------------------------
  // CHARGE VOLUME – respond to SFX mute
  // -------------------------------
  useEffect(() => {
    const audio = chargeAudioRef.current;
    if (!audio) return;

    audio.volume = isSfxMuted ? 0 : 0.2;
  }, [isSfxMuted]);

  // -------------------------------
  // CLEANUP ON UNMOUNT
  // -------------------------------

  useEffect(() => {
    return () => {
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
      }

      const drainA = drainAudioRef.current;
      if (drainA) {
        try {
          drainA.pause();
          drainA.currentTime = 0;
        } catch {}
      }

      const scanA = scanAudioRef.current;
      if (scanA) {
        try {
          scanA.pause();
          scanA.currentTime = 0;
        } catch {}
      }
    };
  }, []);

  // -------------------------------
  // HANDLE MAIN BUTTON (Connect / Sync)
  // -------------------------------

  const handleAction = useCallback(async () => {
    setError("");

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

    if (hasAccess === false) return;

    const isManualRecalc = !!hasStats;

    if (isManualRecalc) {
      setManualSyncActive(true);
      setIsDraining(true);
      setDrainValue(1);
    }

    await runGasCalculationWithCache(address, { isManualRecalc });
  }, [connected, address, hasAccess, hasStats, connect, runGasCalculationWithCache]);
  // -------------------------------
  // RIFT COOLDOWN DERIVED INFO
  // -------------------------------

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

  // -------------------------------
  // DETECT WALLET INSTALLED
  // -------------------------------

  const { walletInstalled, providerReady } = useWallet();

  // -------------------------------
  // BUTTON LABEL
  // -------------------------------

  let buttonLabel = "";

  if (!connected) {
    if (connecting) {
      buttonLabel = "Connecting…";
    } else if (!providerReady) {
      buttonLabel = "Detecting Wallet…";
    } else if (!walletInstalled) {
      buttonLabel = "Install Starkey Wallet";
    } else {
      buttonLabel = "Connect Starkey Wallet";
    }
  } else if (loadingAccess) {
    buttonLabel = "Checking Access…";
  } else if (hasAccess === false) {
    buttonLabel = "Access Denied (1,000 $SUPRAWR Needed)";
  } else if (calculating) {
    buttonLabel = "Syncing…";
  } else if (hasStats && cooldownActive) {
    buttonLabel = `Rift Energy Recharging… ${cooldownRemainingSeconds}s`;
  } else {
    buttonLabel = "Sync Rift Data";
  }

  const isButtonDisabled =
    connecting ||
    calculating ||
    loadingAccess ||
    (connected && hasAccess === false) ||
    (connected && hasAccess && hasStats && cooldownActive);

  // -------------------------------
  // USD VALUES
  // -------------------------------

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

  // -------------------------------
  // PROGRESS BAR DISPLAY
  // -------------------------------

  let displayProgressPercent = 0;
  let progressLabelText = "No sync run yet.";

  if (calculating) {
    displayProgressPercent = Math.min(
      100,
      Math.max(0, progressPercent || 5)
    );
    progressLabelText = `Tx pages processed: ${pagesProcessed}`;
  } else if (hasStats) {
    displayProgressPercent = 100;
    progressLabelText = "Last sync complete";
  } else {
    displayProgressPercent = 0;
    progressLabelText = "No sync run yet";
  }

  // -------------------------------
  // ENERGY BAR
  // -------------------------------

  let energyProgress = 0;

  if (!connected || !address) {
    // No wallet
    energyProgress = 0;
  } else if (isDraining) {
    // Drain animation (1 → 0)
    energyProgress = Math.max(0, Math.min(1, drainValue));
  } else if (manualSyncActive && calculating) {
    // Stay empty only while scan is happening
    energyProgress = 0;
  } else if (cooldownActive) {
    // Recharge after scan completes
    energyProgress = cooldownProgress;
  } else {
    // Idle/ready should remain full (no bounce)
    energyProgress = 1;
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

  // -------------------------------
  // FORMATTED DISPLAYS
  // -------------------------------

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
    const approxMonthlySupra = formatApproxSupraDisplay(monthlyAvgSupra);
    monthlySupraDisplay = `${approxMonthlySupra} $SUPRA`;
    if (monthlyAvgUsdDisplay) {
      monthlySupraDisplay += ` (~$${monthlyAvgUsdDisplay})`;
    }
  }

  // -------------------------------
// RIFT ENERGY STATUS LABEL (REAL + MATRIX VERSION)
// -------------------------------

// Determine the real label
let riftStatusLabel = "";
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
  riftStatusLabel = "Ready";
} else {
  riftStatusLabel = "Full";
}

// No matrix effect on Rift Energy label; show the real status text.
const riftStatusLabelText = riftStatusLabel;

  // -------------------------------
  // RETURN
  // -------------------------------

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

        <h1 className="dashboard-title">
          <span className="gas-icon">⛽︎</span> GAS TRACKER
        </h1>

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
                  <strong>SUPRA coin transactions only</strong> for your wallet.
                </p>

                <p>
                  It uses the <code>coin_transactions</code> RPC, the only RPC
                  endpoint that exposes gas usage for Supra coin transfers.
                </p>

                <p>
                  Contract calls, swaps, NFTs, DEX txs, etc. are not included
                  because Supra RPC does not expose their gas usage publicly.
                </p>

                <p>
                  Results cache for 24 hours. Reconnecting inside that window shows cached
                  results instantly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connected Wallet */}
        <div className="field-block">
          <div className="rift-energy-header">
            <label htmlFor="wallet" className="rift-energy-title">
              Connected Supra Wallet
            </label>
            </div>
          <input
            id="wallet"
            type="text"
            className="field-input"
            value={address || ""}
            readOnly
            disabled
          />
        </div>

        {/* Action Button */}
        <button
          className="primary-button"
          onClick={handleAction}
          disabled={isButtonDisabled}
          type="button"
        >
          {buttonLabel}
        </button>

        {/* Rift Energy */}
        <div className="rift-energy-wrapper">
          <div className="rift-energy-header">
            <span className="rift-energy-title">Rift Energy</span>
            <span className="rift-energy-status">{riftStatusLabelText}</span>
          </div>

          <div className={riftBarClassName}>
            <div
              className="rift-energy-bar-fill"
              style={{ width: `${Math.round(energyProgress * 100)}%` }}
            />
          </div>
        </div>

        {/* Progress Bar */}
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

        {/* Errors */}
        {accessError && <div className="alert error">{accessError}</div>}
        {error && <div className="alert error">{error}</div>}

        {/* RESULTS WITH MATRIX EFFECT */}
        {connected && !error && (
          <div className="results">
            {/* TX COUNT */}
            <div className="result-row">
              <span className="result-label">$SUPRA txs synced</span>
              <span className="result-value">
                {calculating
                  ? matrixTx || "00000"
                  : hasStats
                  ? formattedTxCount
                  : "Sync for data"}
              </span>
            </div>

            {/* TOTAL GAS */}
            <div className="result-row">
              <span className="result-label">
                Estimated gas spent on $SUPRA txs
              </span>
              <span className="result-value">
                {calculating
                  ? matrixTotal || "~0.00M"
                  : hasStats
                  ? totalSupraDisplay
                  : "Sync for data"}
              </span>
            </div>

            {/* AVG GAS */}
            <div className="result-row">
              <span className="result-label">
                Average estimated gas per $SUPRA tx
              </span>
              <span className="result-value">
                {calculating
                  ? matrixAvg || "~0.00"
                  : hasStats
                  ? avgSupraDisplay
                  : "Sync for data"}
              </span>
            </div>

            {/* MONTHLY GAS */}
            <div className="result-row">
              <span className="result-label">
                Estimated gas spent per month
              </span>
              <span className="result-value">
                {calculating
                  ? matrixMonthly || "~0.00K"
                  : hasStats
                  ? monthlySupraDisplay
                  : "Sync for data"}
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
