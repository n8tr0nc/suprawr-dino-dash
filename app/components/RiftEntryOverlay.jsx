"use client";

import React, { useEffect, useState } from "react";

/* -----------------------------
   Minimal wallet helpers
------------------------------*/

function detectRawProvider() {
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
    return response.map((a) => normalizeAddress(a)).filter(Boolean);
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

function broadcastWalletState(address, connected) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("suprawr:walletChange", {
      detail: { address, connected },
    })
  );
}

/* -----------------------------
   Rift Entry Overlay
------------------------------*/

export default function RiftEntryOverlay({
  visible,
  onEnterGuest,
  onClose,
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Reset local exit state whenever parent shows overlay again
  useEffect(() => {
    if (visible) {
      setIsExiting(false);
      setIsConnecting(false);
    }
  }, [visible]);

  // Listen for wallet connect -> play static exit, then call onClose
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { connected, address } = event.detail || {};
      if (!connected || !address) return;

      // Wallet connected -> trigger exit animation then close
      setIsExiting(true);
      setIsConnecting(false);

      const timeout = setTimeout(() => {
        setIsExiting(false);
        if (typeof onClose === "function") {
          onClose();
        }
      }, 650); // match CSS animation duration

      return () => clearTimeout(timeout);
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
    };
  }, [onClose]);

  if (!visible && !isExiting) {
    return null;
  }

  const handleConnectClick = async () => {
    const provider = detectRawProvider();

    if (!provider) {
      if (typeof window !== "undefined") {
        window.open("https://starkey.app", "_blank");
      }
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await connectAndGetAccounts(provider);
      if (!accounts || accounts.length === 0) {
        setIsConnecting(false);
        return;
      }

      const addr = accounts[0];
      broadcastWalletState(addr, true);
      // After this, TopRightBar/page.jsx will handle access, FX, etc.
    } catch {
      setIsConnecting(false);
    }
  };

  const handleGuestClick = () => {
    if (typeof onEnterGuest === "function") {
      onEnterGuest();
    }
  };

  const overlayClass = `rift-entry-overlay${
    isExiting ? " rift-entry-overlay--exiting" : ""
  }`;

  return (
    <div className={overlayClass}>
      <div className="rift-entry-noise" />
      <div className="rift-entry-panel">
        <div className="rift-entry-title">RIFT ACCESS TERMINAL</div>
        <div className="rift-entry-subtitle">
          Connect your Starkey wallet to sync with the Dino Dash.
        </div>

        <button
          type="button"
          className="rift-entry-button"
          onClick={handleConnectClick}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting…" : "Connect StarKey Wallet"}
        </button>

        <button
          type="button"
          className="rift-entry-guest"
          onClick={handleGuestClick}
        >
          Enter as guest
        </button>

        <div className="rift-entry-footnote">
          You can always connect later from the top-right wallet button or
          inside the Gas Tracker card.
        </div>
      </div>
    </div>
  );
}
