"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";

/* ---------------------------------------------
   Starkey provider helper (template-style)
--------------------------------------------- */

function getStarkeyProvider() {
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

/* ---------------------------------------------
   Wallet Context
--------------------------------------------- */

export const WalletContext = createContext(null);

/* ---------------------------------------------
   WalletProvider (template-style behavior)
   - No auto-connect
   - No retries
   - No token gating
   - No SSR window usage in render
--------------------------------------------- */

export function WalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [providerReady, setProviderReady] = useState(false);
  const [error, setError] = useState(null);

  // Just mark when we've had a chance to look for Starkey on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // We don’t need to store the provider here, just signal that detection ran.
    getStarkeyProvider();
    setProviderReady(true);
  }, []);

  const broadcastWalletChange = useCallback((addr, isConnected) => {
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(
        new CustomEvent("suprawr:walletChange", {
          detail: { address: addr, connected: isConnected },
        })
      );
    } catch {
      // ignore if CustomEvent not supported for some reason
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);

    const provider = getStarkeyProvider();

    // Template-style behavior: if no provider, open Starkey site.
    if (!provider) {
      if (typeof window !== "undefined") {
        window.open("https://starkey.app", "_blank");
      }
      return;
    }

    try {
      const res = await provider.connect();
      const accounts = normalizeAccounts(res);

      if (!accounts.length) {
        throw new Error("Starkey did not return any accounts.");
      }

      const addr = accounts[0];
      setConnected(true);
      setAddress(addr);
      broadcastWalletChange(addr, true);
    } catch (e) {
      console.error("Wallet connect failed:", e);
      setError("Failed to connect wallet.");
      setConnected(false);
      setAddress(null);
      broadcastWalletChange(null, false);
    }
  }, [broadcastWalletChange]);

  const disconnect = useCallback(async () => {
    const provider = getStarkeyProvider();

    if (provider) {
      try {
        if (typeof provider.disconnect === "function") {
          await provider.disconnect();
        } else if (typeof provider.disconnectWallet === "function") {
          await provider.disconnectWallet();
        }
      } catch (e) {
        console.warn("Starkey disconnect error:", e);
      }
    }

    setConnected(false);
    setAddress(null);
    setError(null);
    broadcastWalletChange(null, false);
  }, [broadcastWalletChange]);

  const value = {
    providerReady,
    connected,
    address,
    error,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
