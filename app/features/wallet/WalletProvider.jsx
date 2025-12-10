"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";

export const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [providerReady, setProviderReady] = useState(false);
  const [walletInstalled, setWalletInstalled] = useState(false);

  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  // Detect Starkey provider once on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const starkey = window.starkey?.supra ?? null;
    setProvider(starkey);
    setWalletInstalled(!!starkey);
    setProviderReady(true);
  }, []);

  const connect = useCallback(async () => {
    // No provider → open Starkey site (template behavior)
    if (!provider) {
      if (typeof window !== "undefined") {
        try {
          window.open("https://starkey.app", "_blank", "noopener,noreferrer");
        } catch {
          // ignore
        }
      }
      return;
    }

    try {
      const res = await provider.connect();
      let accounts = [];

      if (Array.isArray(res)) {
        accounts = res;
      } else if (res && Array.isArray(res.accounts)) {
        accounts = res.accounts;
      }

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
      // swallow – we still clear local state
    }

    setConnected(false);
    setAddress(null);
  }, [provider]);

  const value = {
    providerReady,
    walletInstalled,
    connected,
    address,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
