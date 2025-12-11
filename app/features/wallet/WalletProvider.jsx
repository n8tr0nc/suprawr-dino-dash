"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";

export const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [providerReady, setProviderReady] = useState(false);
  const [walletInstalled, setWalletInstalled] = useState(false);

  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  // ----------------------------------------------------
  // ROBUST PROVIDER DETECTION — POLL UNTIL STARKY LOADS
  // ----------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    let attempts = 0;
    const maxAttempts = 20;     // ~6 seconds
    const interval = 300;       // ms between checks

    const detectProvider = () => {
      const starkey = window.starkey?.supra ?? null;

      if (starkey) {
        setProvider(starkey);
        setWalletInstalled(true);
        setProviderReady(true);
        return;
      }

      attempts++;

      if (attempts >= maxAttempts) {
        // Provider failed to load in time
        setProvider(null);
        setWalletInstalled(false);
        setProviderReady(true);
        return;
      }

      setTimeout(detectProvider, interval);
    };

    detectProvider();
  }, []);

  // ----------------------------------------------------
  // CONNECT
  // ----------------------------------------------------
  const connect = useCallback(async () => {
    if (!provider) {
      try {
        window.open("https://starkey.app", "_blank", "noopener,noreferrer");
      } catch {}
      return;
    }

    try {
      const res = await provider.connect();
      let accounts = [];

      if (Array.isArray(res)) accounts = res;
      else if (res && Array.isArray(res.accounts)) accounts = res.accounts;

      const first = accounts[0];
      let nextAddress = null;

      if (typeof first === "string") {
        nextAddress = first;
      } else if (first && typeof first === "object") {
        nextAddress =
          first.address ||
          first.addr ||
          first.account ||
          first.walletAddress ||
          null;
      }

      if (nextAddress) {
        setConnected(true);
        setAddress(nextAddress);
      } else {
        setConnected(false);
        setAddress(null);
      }
    } catch (err) {
      console.error("[WalletProvider] connect error:", err);
      setConnected(false);
      setAddress(null);
    }
  }, [provider]);

  // ----------------------------------------------------
  // DISCONNECT
  // ----------------------------------------------------
  const disconnect = useCallback(async () => {
    try {
      if (provider && typeof provider.disconnect === "function") {
        await provider.disconnect();
      } else if (
        provider &&
        typeof provider.disconnectWallet === "function"
      ) {
        await provider.disconnectWallet();
      }
    } catch (err) {
      console.warn("[WalletProvider] provider disconnect error:", err);
    }

    setConnected(false);
    setAddress(null);
  }, [provider]);

  // ----------------------------------------------------
  // CONTEXT VALUE
  // ----------------------------------------------------
  const value = {
    providerReady,
    walletInstalled,
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
