"use client";

import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

/* ---------------------------------------------------------
   MASTER ACCESS GATE TOGGLE
   Set to true  = access check enabled (normal behavior)
   Set to false = access check completely bypassed
--------------------------------------------------------- */
const ACCESS_ENABLED = false;

/* ---------------------------------------------------------------------------
   CONSTANTS
--------------------------------------------------------------------------- */

// How often we allow a fresh balance fetch per wallet (ms)
const BALANCE_CACHE_TTL = 3_600_000; // 60 minutes

// Max time to keep retrying for provider on first load (ms)
const PROVIDER_DETECT_WINDOW_MS = 5000;
const PROVIDER_DETECT_INTERVAL_MS = 400;

/* ---------------------------------------------------------------------------
   WALLET PROVIDER HELPERS (StarKey / window.starkey)
--------------------------------------------------------------------------- */

function detectProvider() {
  if (typeof window === "undefined") return null;

  if (!("starkey" in window)) {
    return null;
  }

  const provider = window.starkey?.supra;
  return provider || null;
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
  if (!provider) return [];

  // Newer StarKey API
  if (typeof provider.connectWallet === "function") {
    try {
      await provider.connectWallet({ multiple: false, network: "SUPRA" });
    } catch {
      // Fallback for older versions
      await provider.connectWallet();
    }

    if (typeof provider.getCurrentAccount === "function") {
      const acc = await provider.getCurrentAccount();
      return normalizeAccounts(acc);
    }
  }

  // Generic connect()
  if (typeof provider.connect === "function") {
    const res = await provider.connect();
    return normalizeAccounts(res);
  }

  // Generic account() getter
  if (typeof provider.account === "function") {
    const res = await provider.account();
    return normalizeAccounts(res);
  }

  return [];
}

async function getExistingAccounts(provider) {
  if (!provider) return [];

  if (typeof provider.getCurrentAccount === "function") {
    const acc = await provider.getCurrentAccount();
    return normalizeAccounts(acc);
  }

  if (typeof provider.account === "function") {
    const res = await provider.account();
    return normalizeAccounts(res);
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

/* ---------------------------------------------------------------------------
   ACCESS TIER HELPER
--------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
   CONTEXT
--------------------------------------------------------------------------- */

export const AccessContext = createContext(null);

/* ---------------------------------------------------------------------------
   PROVIDER
--------------------------------------------------------------------------- */

export function AccessProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [providerReady, setProviderReady] = useState(false);

  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

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
  const connectingRef = useRef(false);

  // -------------------------------------------------------------------------
  // Broadcast helpers
  // -------------------------------------------------------------------------

  const broadcastWalletChange = useCallback((addr, isConnected) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("suprawr:walletChange", {
        detail: { address: addr, connected: isConnected },
      })
    );
  }, []);

  const broadcastTierUpdate = useCallback(
    (tier, supraWrDisplay, supraDisplay, burnDisplay) => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("suprawr:tierUpdate", {
          detail: {
            holderRank: tier,
            balanceDisplay: supraWrDisplay,
            supraBalance: supraDisplay,
            burnDisplay: burnDisplay,
          },
        })
      );
    },
    []
  );

  // -------------------------------------------------------------------------
  // Balance / stats fetcher
  // -------------------------------------------------------------------------

  const fetchAllBalances = useCallback(
    async (addr, options = {}) => {
      if (!addr) return;
      const {
        force = false,
        includeAccessCheck = false, // only run gate when true
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
        if (
          supraJson &&
          supraJson.ok !== false &&
          typeof supraJson.balanceDisplay === "string"
        ) {
          setSupraBalance(supraJson.balanceDisplay);
        } else {
          setSupraBalance(null);
        }

        // SUPRA price (USD)
        if (
          priceJson &&
          priceJson.ok !== false &&
          typeof priceJson.priceUsd === "number"
        ) {
          setSupraUsdPrice(priceJson.priceUsd);
        } else {
          setSupraUsdPrice(null);
        }

        // SUPRAWR balance + tier (always) + gate (optionally)
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

          // Always compute + set tier from SUPRAWR balance
          tier = computeTierFromSupraWr(supraWrDisplay);
          setAccessTier(tier);

          if (includeAccessCheck) {
            if (typeof supraWrJson.meetsRequirement === "boolean") {
              access = supraWrJson.meetsRequirement;
            } else {
              const clean = Number(
                String(supraWrDisplay).replace(/,/g, "")
              );
              access = Number.isFinite(clean) && clean >= 1000;
            }
            setHasAccess(access);
          }
        } else {
          setSupraWrBalance(null);
          setAccessTier(null);
          if (includeAccessCheck) setHasAccess(null);
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

        // Broadcast (only when we recompute gate)
        if (includeAccessCheck) {
          broadcastTierUpdate(
            tier,
            supraWrDisplay,
            supraJson && supraJson.balanceDisplay,
            burnDisplay
          );
        }
      } catch (err) {
        console.error("Balance fetch error:", err);
        setError("Failed to refresh wallet stats.");
        setSupraBalance(null);
        setSupraWrBalance(null);
        setBurnTotal(null);
        setSupraUsdPrice(null);
        setAccessTier(null);
        if (includeAccessCheck) setHasAccess(null);
      } finally {
        setLoadingBalances(false);
        if (includeAccessCheck) setLoadingAccess(false);
      }
    },
    [broadcastTierUpdate]
  );

  // -------------------------------------------------------------------------
  // Connect / disconnect
  // -------------------------------------------------------------------------

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;

    try {
      // Re-check for Starkey in case it injected after initial load
      let activeProvider = provider;

      if (!activeProvider && typeof window !== "undefined") {
        const maybe = detectProvider();
        if (maybe) {
          setProvider(maybe);
          activeProvider = maybe;
        }
      }

      // If we still don't have a provider, open Starkey site
      if (!activeProvider) {
        if (typeof window !== "undefined") {
          window.open("https://starkey.app", "_blank");
        }
        return;
      }

      // First attempt to connect + get accounts
      let accounts = await connectAndGetAccounts(activeProvider);

      // If still empty, give provider a brief moment and re-check existing accounts
      if (!accounts.length) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));
          accounts = await getExistingAccounts(activeProvider);
        } catch {
          // ignore secondary failure, will be handled by length check
        }
      }

      if (!accounts.length) {
        throw new Error("StarKey did not return any accounts.");
      }

      const addr = accounts[0];

      setConnected(true);
      setAddress(addr);
      broadcastWalletChange(addr, true);

      if (!ACCESS_ENABLED) {
        setHasAccess(true);
      }

      await fetchAllBalances(addr, {
        force: true,
        includeAccessCheck: ACCESS_ENABLED,
      });
    } catch (e) {
      console.error("Wallet connect failed:", e);
      setError("Failed to connect wallet.");
    } finally {
      connectingRef.current = false;
    }
  }, [provider, broadcastWalletChange, fetchAllBalances]);

  const disconnect = useCallback(async () => {
    await disconnectWallet(provider);

    setConnected(false);
    setAddress(null);

    setSupraBalance(null);
    setSupraWrBalance(null);
    setBurnTotal(null);
    setSupraUsdPrice(null);
    setAccessTier(null);
    setHasAccess(null);
    setError(null);
    lastBalanceFetchRef.current = 0;

    broadcastWalletChange(null, false);
    broadcastTierUpdate(null, null, null, null);
  }, [provider, broadcastWalletChange, broadcastTierUpdate]);

  // -------------------------------------------------------------------------
  // Detect provider & auto-connect if already linked
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (providerReady && provider) return;
    let cancelled = false;
    const start = Date.now();

    const tryDetect = async () => {
      if (cancelled) return;

      const found = detectProvider();
      if (found && !cancelled) {
        setProvider(found);
        setProviderReady(true);

        try {
          const existing = await getExistingAccounts(found);
          if (existing.length > 0 && !cancelled) {
            const addr = existing[0];
            setConnected(true);
            setAddress(addr);
            broadcastWalletChange(addr, true);

            if (!ACCESS_ENABLED) {
              setHasAccess(true);
            }

            await fetchAllBalances(addr, {
              force: true,
              includeAccessCheck: ACCESS_ENABLED,
            });
          }
        } catch (err) {
          console.warn("Auto-connect check failed:", err);
        }

        return; // stop retrying
      }

      if (Date.now() - start >= PROVIDER_DETECT_WINDOW_MS) {
        if (!cancelled) setProviderReady(true);
        return;
      }

      setTimeout(tryDetect, PROVIDER_DETECT_INTERVAL_MS);
    };

    tryDetect();

    return () => {
      cancelled = true;
    };
  }, [provider, providerReady, broadcastWalletChange, fetchAllBalances]);

  // -------------------------------------------------------------------------
  // Auto-refresh balances on interval while connected
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!connected || !address) return;

    const id = setInterval(() => {
      fetchAllBalances(address, {
        force: false,
        includeAccessCheck: false,
      });
    }, BALANCE_CACHE_TTL);

    return () => clearInterval(id);
  }, [connected, address, fetchAllBalances]);

  // -------------------------------------------------------------------------
  // Provider event listeners (accountsChanged / disconnect)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!provider || typeof provider.on !== "function") return;

    const handleAccountsChanged = (accs) => {
      const accounts = normalizeAccounts(accs);
      if (accounts.length === 0) {
        // Treat as disconnect
        disconnect();
        return;
      }

      const addr = accounts[0];
      setConnected(true);
      setAddress(addr);
      broadcastWalletChange(addr, true);

      if (!ACCESS_ENABLED) {
        setHasAccess(true);
      }

      fetchAllBalances(addr, {
        force: true,
        includeAccessCheck: ACCESS_ENABLED,
      });
    };

    const handleDisconnect = () => {
      disconnect();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("disconnect", handleDisconnect);

    return () => {
      try {
        provider.removeListener?.("accountsChanged", handleAccountsChanged);
        provider.removeListener?.("disconnect", handleDisconnect);
      } catch {
        // ignore
      }
    };
  }, [provider, disconnect, broadcastWalletChange, fetchAllBalances]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value = {
    providerReady,
    connected,
    address,
    supraBalance,
    supraWrBalance,
    burnTotal,
    supraUsdPrice,
    accessTier,
    hasAccess,
    loadingBalances,
    loadingAccess,
    error,
    connect,
    disconnect,
    refresh: () => {
      if (address) {
        setAccessTier(null);
        return fetchAllBalances(address, {
          force: true,
          includeAccessCheck: false,
        });
      }
    },
  };

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}
