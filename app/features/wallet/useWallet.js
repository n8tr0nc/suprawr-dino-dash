"use client";

import { useState, useEffect, useCallback } from "react";

function getStarkeyProvider() {
  if (typeof window === "undefined") return null;
  // Starkey injects `window.starkey.supra`
  return window.starkey && window.starkey.supra
    ? window.starkey.supra
    : null;
}

/**
 * Pure Starkey wallet hook.
 * - NO AccessProvider
 * - Safe detection
 * - Connect / disconnect helpers
 * - Handles "no accounts" safely
 */
export function useWallet() {
  const [provider, setProvider] = useState(null);
  const [providerReady, setProviderReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Detect provider + any already-connected account
  useEffect(() => {
    const p = getStarkeyProvider();

    if (!p) {
      setProvider(null);
      setProviderReady(false);
      setConnected(false);
      setAddress(null);
      return;
    }

    setProvider(p);
    setProviderReady(true);

    // Try to read existing account (if wallet is already connected)
    (async () => {
      try {
        let accounts = [];

        if (typeof p.account === "function") {
          accounts = await p.account();
        } else if (typeof p.request === "function") {
          // Fallback, in case Starkey exposes a request-style API
          accounts = await p.request({ method: "starkey_accounts" });
        }

        if (Array.isArray(accounts) && accounts.length > 0) {
          const addr = accounts[0];
          setConnected(true);
          setAddress(addr);
        }
      } catch (err) {
        console.warn("Starkey init: failed to read existing accounts:", err);
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    const p = provider || getStarkeyProvider();

    if (!p) {
      // Let the UI decide how to handle "not installed"
      throw new Error("StarKey wallet is not available in this browser.");
    }

    setIsConnecting(true);

    try {
      let accounts = [];

      if (typeof p.connect === "function") {
        accounts = await p.connect();
      } else if (typeof p.request === "function") {
        accounts = await p.request({ method: "starkey_connect" });
      } else if (typeof p.account === "function") {
        accounts = await p.account();
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("StarKey did not return any accounts.");
      }

      const addr = Array.isArray(accounts)
        ? accounts[0]
        : accounts.address || accounts.account || null;

      if (!addr) {
        throw new Error("StarKey responded without a usable address.");
      }

      setProvider(p);
      setProviderReady(true);
      setConnected(true);
      setAddress(addr);

      return addr;
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    const p = provider || getStarkeyProvider();

    try {
      if (p && typeof p.disconnect === "function") {
        await p.disconnect();
      }
    } catch (err) {
      console.warn("Starkey disconnect error:", err);
    } finally {
      setConnected(false);
      setAddress(null);
    }
  }, [provider]);

  return {
    providerReady,
    providerInstalled: !!getStarkeyProvider(),
    isConnecting,
    connected,
    address,
    connect,
    disconnect,
  };
}
