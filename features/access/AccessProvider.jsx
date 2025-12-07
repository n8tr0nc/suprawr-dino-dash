"use client";

import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

/* -----------------------------------------------------------------------------
   CONSTANTS
----------------------------------------------------------------------------- */

// How often we allow a fresh balance fetch per wallet (ms)
const BALANCE_CACHE_TTL = 120_000; // 2 minutes

/* -----------------------------------------------------------------------------
   WALLET PROVIDER HELPERS (StarKey / window.starkey)
----------------------------------------------------------------------------- */

function detectProvider() {
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
  if (!provider) return [];

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

/* -----------------------------------------------------------------------------
   ACCESS TIER HELPER
----------------------------------------------------------------------------- */

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

  if (whole >= 10_000_000n) return "Primal Master";
  if (whole >= 1_000_000n) return "Primal Titan";
  if (whole >= 100_000n) return "Primal Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  return "Hatchling";
}

/* -----------------------------------------------------------------------------
   CONTEXT
----------------------------------------------------------------------------- */

export const AccessContext = createContext(null);

/* -----------------------------------------------------------------------------
   PROVIDER
----------------------------------------------------------------------------- */

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

  const fetchAllBalances = useCallback(
    async (addr, options = {}) => {
      if (!addr) return;
      const { force = false } = options;

      const now = Date.now();
      if (!force && now - lastBalanceFetchRef.current < BALANCE_CACHE_TTL) {
        return;
      }
      lastBalanceFetchRef.current = now;

      setLoadingBalances(true);
      setLoadingAccess(true);
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

        // SUPRAWR balance + tier + gate
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

          tier = computeTierFromSupraWr(supraWrDisplay);
          setAccessTier(tier);

          if (typeof supraWrJson.meetsRequirement === "boolean") {
            access = supraWrJson.meetsRequirement;
          } else {
            const clean = Number(
              String(supraWrDisplay).replace(/,/g, "")
            );
            access = Number.isFinite(clean) && clean >= 1000;
          }
          setHasAccess(access);
        } else {
          setSupraWrBalance(null);
          setAccessTier(null);
          setHasAccess(null);
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

        // Broadcast for any legacy listeners (old components still listening)
        broadcastTierUpdate(
          tier,
          supraWrDisplay,
          supraJson && supraJson.balanceDisplay,
          burnDisplay
        );
      } catch (err) {
        console.error("Balance fetch error:", err);
        setError("Failed to refresh wallet stats.");
        setSupraBalance(null);
        setSupraWrBalance(null);
        setBurnTotal(null);
        setAccessTier(null);
        setHasAccess(null);
      } finally {
        setLoadingBalances(false);
        setLoadingAccess(false);
      }
    },
    [broadcastTierUpdate]
  );

  // Detect provider & auto-connect if wallet already linked
  useEffect(() => {
    if (providerReady) return;
    const raw = detectProvider();

    if (raw) {
      setProvider(raw);
      setProviderReady(true);

      (async () => {
        try {
          const existing = await getExistingAccounts(raw);
          if (existing.length > 0) {
            const addr = existing[0];
            setConnected(true);
            setAddress(addr);
            broadcastWalletChange(addr, true);
            await fetchAllBalances(addr, { force: true });
          }
        } catch (err) {
          console.warn("Auto-connect check failed:", err);
        }
      })();
    } else {
      setProviderReady(true);
    }
  }, [providerReady, broadcastWalletChange, fetchAllBalances]);

  // Auto-refresh balances on an interval while connected
  useEffect(() => {
    if (!connected || !address) return;

    const id = setInterval(() => {
      fetchAllBalances(address, { force: false });
    }, BALANCE_CACHE_TTL);

    return () => clearInterval(id);
  }, [connected, address, fetchAllBalances]);

  const connect = useCallback(async () => {
    if (!provider) {
      if (typeof window !== "undefined") {
        window.open("https://starkey.app", "_blank");
      }
      return;
    }

    try {
      const accounts = await connectAndGetAccounts(provider);
      if (!accounts.length) {
        throw new Error("StarKey did not return any accounts.");
      }
      const addr = accounts[0];

      setConnected(true);
      setAddress(addr);
      broadcastWalletChange(addr, true);

      await fetchAllBalances(addr, { force: true });
    } catch (e) {
      console.error("Wallet connect failed:", e);
      setError("Failed to connect wallet.");
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
    // manual refresh from Sidebar or anywhere
    refresh: () => {
      if (address) {
        return fetchAllBalances(address, { force: true });
      }
    },
  };

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}
