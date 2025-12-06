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
   Rift Entry Overlay (pure UI)
------------------------------*/

export default function RiftEntryOverlay({ visible, onEnterGuest }) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);
  const [isConnecting, setIsConnecting] = useState(false);

  // Control mount/unmount + exit animation from the `visible` prop
  useEffect(() => {
    if (visible) {
      // Show overlay
      setShouldRender(true);
      setIsExiting(false);
      setIsConnecting(false);
      return;
    }

    // If it was visible and is now false, play exit animation then unmount
    if (!visible && shouldRender) {
      setIsExiting(true);
      const timeoutId = setTimeout(() => {
        setIsExiting(false);
        setShouldRender(false);
      }, 700); // matches rift-terminal-overlay-fade duration
      return () => clearTimeout(timeoutId);
    }
  }, [visible, shouldRender]);

  if (!shouldRender) return null;

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
      // page.jsx / TopBar handle the rest (FX + closing overlay)
    } catch {
      // swallow error, just reset connecting
    } finally {
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
      <div className="rift-entry-reticle" />

      {/* HUD LORE PANELS (corner terminals) */}
      <div className="rift-entry-hud rift-entry-hud--tl">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">ORIGIN COORDS //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Dimension</span>
            <span className="rift-entry-hud-value">The Primal Rift</span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Galaxy</span>
            <span className="rift-entry-hud-value">Aetherion Spiral</span>
          </div>
        </div>
      </div>

      <div className="rift-entry-hud rift-entry-hud--tr">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">STELLAR LOCK //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">System</span>
            <span className="rift-entry-hud-value">D-88 Draxion Cluster</span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">World</span>
            <span className="rift-entry-hud-value">Rawrion Prime</span>
          </div>
        </div>
      </div>

      <div className="rift-entry-hud rift-entry-hud--bl">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">RIFT SUBSTRATE //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Crystals</span>
            <span className="rift-entry-hud-value">
              Rift Crystals · Tri-Moon
            </span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Chain</span>
            <span className="rift-entry-hud-value">
              SUPRA · Quantum-stable data flow
            </span>
          </div>
        </div>
      </div>

      <div className="rift-entry-hud rift-entry-hud--br">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">SUPRAWR SIGNATURE //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Credential</span>
            <span className="rift-entry-hud-value">
              $SUPRAWR access token
            </span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Access scope</span>
            <span className="rift-entry-hud-value">DinoDash telemetry</span>
          </div>
        </div>
      </div>

      {/* CENTRAL HANDSHAKE TERMINAL */}
      <div className="rift-entry-panel">
        <div className="rift-entry-header">
          <img
            src="/suprawr001.webp"
            alt="SUPRAWR Dino"
            className="rift-entry-logo"
          />
          <div className="rift-entry-brand">
            <span className="rift-entry-brand-main">
              SUPRAWR CREW // RIFT ACCESS TERMINAL
            </span>
            <span className="rift-entry-brand-sub">
              Super Unified Primal Rift Architecture · Supra mainnet mirror
            </span>
          </div>
        </div>

        <div className="rift-entry-status-block">
          <div className="rift-entry-status-line">
            <span className="rift-entry-status-prefix">&gt;</span>
            <span> SUPRA link online. Rift channels stabilized.</span>
          </div>
          <div className="rift-entry-status-line">
            <span className="rift-entry-status-prefix">&gt;</span>
            <span>
              {" "}
              Awaiting Starkey identity signature bound to $SUPRAWR DNA.
            </span>
          </div>
          <div className="rift-entry-status-line">
            <span className="rift-entry-status-prefix">&gt;</span>
            {isConnecting ? (
              <span>
                Syncing creds across Primal Rift nodes. Handshake in progress…{" "}
                <span className="rift-entry-caret" />
              </span>
            ) : (
              <span>
                Connect wallet to unlock fleet telemetry and personal gas logs.
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="rift-entry-button"
          onClick={handleConnectClick}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting Starkey Wallet…" : "Connect Starkey Wallet"}
        </button>

        <button
          type="button"
          className="rift-entry-guest"
          onClick={handleGuestClick}
        >
          Enter as guest (no telemetry · no $SUPRAWR signature)
        </button>
      </div>
    </div>
  );
}
