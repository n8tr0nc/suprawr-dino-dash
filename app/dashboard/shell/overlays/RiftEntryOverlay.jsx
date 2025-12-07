"use client";

import React, { useEffect, useState } from "react";
import { useAccess } from "../../../../features/access/useAccess";

/* -----------------------------
   Rift Entry Overlay
------------------------------*/

export default function RiftEntryOverlay({ visible, onEnterGuest }) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect, connected } = useAccess();

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
      console.error("RiftEntryOverlay connect error:", err);
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

      {/* MAIN TERMINAL */}
      <div className="rift-entry-terminal">
        <div className="rift-entry-terminal-window">
          <div className="rift-entry-terminal-header">
            <span className="rift-entry-terminal-title">
              SUPRAWR / RIFT-ENTRY
            </span>
            <span className="rift-entry-terminal-status">
              STATUS:{" "}
              <span className="rift-entry-terminal-status-pill">
                STANDING BY
              </span>
            </span>
          </div>

          <div className="rift-entry-terminal-body">
            <p className="rift-entry-line">
              &gt; Initializing RAWRpack link… <span className="cursor" />
            </p>
            <p className="rift-entry-line">
              &gt; Supra mainnet connection: <span className="ok-text">READY</span>
            </p>
            <p className="rift-entry-line">
              &gt; SUPRAWR telemetry: <span className="ok-text">LISTENING</span>
            </p>
            <p className="rift-entry-line">
              &gt; Dino Dash gas tracker:{" "}
              <span className="ok-text">ARMS WARMED</span>
            </p>
            <p className="rift-entry-line">
              &gt; Rift energy status: <span className="ok-text">PRIMED</span>
            </p>
          </div>
        </div>

        <div className="rift-entry-cta">
          <div className="rift-entry-logo-block">
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
              <span className="rift-entry-status-label">Rift Lock</span>
              <span className="rift-entry-status-value">Secure · Encrypted</span>
            </div>
            <div className="rift-entry-status-line">
              <span className="rift-entry-status-label">Telemetry</span>
              <span className="rift-entry-status-value">
                Wallet needed to read Dino Dash stats
              </span>
            </div>
          </div>

          <button
            type="button"
            className="rift-entry-connect"
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
    </div>
  );
}
