"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const WalletContext = createContext(null);

/**
 * WalletProvider - Template-style, stable, minimal.
 * Handles ONLY:
 *  - Starkey detection
 *  - Connect
 *  - Disconnect
 *  - Wallet address state
 *
 * No stats, no tiers, no gating in this layer.
 */
export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [providerReady, setProviderReady] = useState(false);

  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  // Detect provider on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const detected =
      window.starkey && window.starkey.supra ? window.starkey.supra : null;

    setProvider(detected);
    setProviderReady(true);
  }, []);

  const connect = useCallback(async () => {
    if (!provider) {
      // Starkey not installed → open website
      if (typeof window !== "undefined") {
        window.open("https://starkey.app", "_blank");
      }
      return;
    }

    try {
      const res = await provider.connect();
      const account =
        Array.isArray(res) && res.length > 0 ? res[0] : null;

      if (!account) {
        console.warn("Starkey returned no accounts.");
        return;
      }

      setConnected(true);
      setAddress(account);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
  }, []);

  const value = {
    providerReady,
    provider,
    connected,
    address,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
