"use client";

import React, { useEffect, useState } from "react";
import { useAccess } from "../../../../features/access/useAccess";

/* -----------------------------
   Rift Entry Overlay
------------------------------*/
const OVERLAY_ANIM_MS = 2000;

export default function RiftEntryOverlay({ visible, onEnterGuest }) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const { connect, connected } = useAccess();

  // Control mount/unmount + entry/exit animation from the `visible` prop
  useEffect(() => {
    if (visible) {
      // Show overlay and play entry animation
      setShouldRender(true);
      setIsExiting(false);
      setIsConnecting(false);
      setIsEntering(true);

      const timeoutId = setTimeout(() => {
        setIsEntering(false);
      }, OVERLAY_ANIM_MS);

      return () => clearTimeout(timeoutId);
    }

    // If it was visible and is now false, play exit animation then unmount
    if (!visible && shouldRender) {
      setIsExiting(true);
      const timeoutId = setTimeout(() => {
        setIsExiting(false);
        setShouldRender(false);
      }, OVERLAY_ANIM_MS);

      return () => clearTimeout(timeoutId);
    }
  }, [visible, shouldRender]);

  // Auto-dismiss overlay when wallet actually becomes connected
  useEffect(() => {
    if (connected) {
      // force immediate exit transition
      if (typeof onEnterGuest === "function") {
        onEnterGuest();
      }
    }
  }, [connected, onEnterGuest]);

  if (!shouldRender) return null;

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      // Use unified AccessProvider connect logic
      await connect();

      // On successful connect, immediately enter the Rift
      if (typeof onEnterGuest === "function") {
        onEnterGuest();
      }
    } catch (err) {
      // Swallow errors here; visual feedback comes from wallet / top bar
      console.warn("RiftEntryOverlay connect error:", err);
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
  }${isEntering ? " rift-entry-overlay--entering" : ""}`;

  // Detect whether Starkey is installed
  const walletInstalled =
    typeof window !== "undefined" &&
    window.starkey &&
    window.starkey.supra;

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
            <span className="rift-entry-hud-value">
              The Primal Rift
            </span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Galaxy</span>
            <span className="rift-entry-hud-value">
              Aetherion Spiral
            </span>
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
            <span className="rift-entry-hud-value">
              Rawrion Prime
            </span>
          </div>
        </div>
      </div>

      <div className="rift-entry-hud rift-entry-hud--bl">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">RIFT SUBSTRATE //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Crystals</span>
            <span className="rift-entry-hud-value">Tri-Moon Rift Crystals</span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Chain</span>
            <span className="rift-entry-hud-value">SUPRA · Quantum-stable data flow</span>
          </div>
        </div>
      </div>

      <div className="rift-entry-hud rift-entry-hud--br">
        <div className="rift-entry-hud-inner">
          <div className="rift-entry-hud-title">SUPRAWR SIGNATURE //</div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Credential</span>
            <span className="rift-entry-hud-value">
              Suprawr Crew
            </span>
          </div>
          <div className="rift-entry-hud-row">
            <span className="rift-entry-hud-key">Access Scope</span>
            <span className="rift-entry-hud-value">
              DinoDash telemetry
            </span>
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
              // RIFT ACCESS TERMINAL //
            </span>
            <span className="rift-entry-brand-sub">
              Super Unified Primal Rift Architecture · Local Supra Mainnet
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
            <span> Awaiting Starkey identity signature bound to $SUPRAWR DNA.</span>
          </div>
          <div className="rift-entry-status-line">
            <span className="rift-entry-status-prefix">&gt;</span>
            {isConnecting ? (
              <span>
                Syncing creds across Primal Rift nodes. Handshake in progress… 
                <span className="rift-entry-caret" />
              </span>
            ) : (
              <span>
                Connect wallet to unlock wallet logs and telemetry.
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
          {isConnecting
            ? "Connecting Starkey Wallet…"
            : walletInstalled
            ? "Connect Starkey Wallet"
            : "Install Starkey Wallet"}
        </button>

        <button
          type="button"
          className="rift-entry-guest"
          onClick={handleGuestClick}
        >
          Enter as guest (no telemetry · no $SUPRAWR signature)
        </button>

        {/*<div className="rift-entry-footnote">
          Guest mode shows Dino Dash analytics without signing any transactions.
          Connect later from the top-right wallet button to bind this terminal
          to your fleet identity.
        </div>*/}
      </div>
    </div>
  );
}
