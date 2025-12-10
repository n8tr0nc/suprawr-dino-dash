"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useWallet } from "../../../features/wallet/useWallet";

/* -----------------------------
   Rift Entry Overlay
------------------------------*/

/**
 * Keep this in sync with the rift entry overlay
 * animation duration in rift.css (rift-terminal-overlay-enter / -fade).
 */
const OVERLAY_ANIM_MS = 900; // ms

export default function RiftEntryOverlay({
  visible,
  onEnterGuest,
  ensureBgAudio, // callback from Page to start bg audio
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  // NEW: wallet hook instead of useAccess
  const { connect, connected } = useWallet();

  // Detect whether Starkey is installed (for button label)
  const [walletInstalled, setWalletInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasStarkey =
      "starkey" in window && !!window.starkey?.supra;

    setWalletInstalled(hasStarkey);
  }, []);

  // Single shared audio instance for terminal "ping" SFX
  const audioRef = useRef(null);
  const hasPlayedEntryRef = useRef(false);
  const hasPlayedExitRef = useRef(false);

  // Create the audio object once on the client and clean it up on unmount
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!audioRef.current) {
      const audio = new Audio("/audio/terminal-000.mp3");
      audio.volume = 0.4; // tweak to taste
      audioRef.current = audio;
    }

    // Hardening: make sure we don't leave a playing sound behind
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    };
  }, []);

  const playTerminalSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // ignore autoplay / focus errors – cosmetic only
      });
    } catch {
      // fail silently
    }
  }, []);

  // Tie sound + state changes directly to enter/exit transitions
  useEffect(() => {
    // Nothing to do if overlay is fully gone and should not render
    if (!visible && !shouldRender) return;

    // ---- ENTERING ----
    if (visible) {
      setShouldRender(true);
      setIsExiting(false);
      setIsConnecting(false);
      setIsEntering(true);

      if (!hasPlayedEntryRef.current) {
        playTerminalSound(); // play once at start of enter
        hasPlayedEntryRef.current = true;
        hasPlayedExitRef.current = false;
      }

      const timeoutId = setTimeout(() => {
        setIsEntering(false);
      }, OVERLAY_ANIM_MS);

      return () => clearTimeout(timeoutId);
    }

    // ---- EXITING ----
    if (!visible && shouldRender) {
      setIsExiting(true);

      if (!hasPlayedExitRef.current) {
        playTerminalSound(); // play once at start of exit
        hasPlayedExitRef.current = true;
        hasPlayedEntryRef.current = false;
      }

      const timeoutId = setTimeout(() => {
        setIsExiting(false);
        setShouldRender(false);
      }, OVERLAY_ANIM_MS);

      return () => clearTimeout(timeoutId);
    }
  }, [visible, shouldRender, playTerminalSound]);

  // Auto-dismiss overlay when wallet actually becomes connected
  useEffect(() => {
    if (connected && typeof onEnterGuest === "function") {
      onEnterGuest();
    }
  }, [connected, onEnterGuest]);

  if (!shouldRender) return null;

  const overlayClass = `rift-entry-overlay${
    isExiting ? " rift-entry-overlay--exiting" : ""
  }${isEntering ? " rift-entry-overlay--entering" : ""}`;

  const handleConnectClick = async () => {
    // Start bg audio from this user interaction
    if (typeof ensureBgAudio === "function") {
      ensureBgAudio();
    }

    try {
      setIsConnecting(true);
      await connect();
      if (typeof onEnterGuest === "function") {
        onEnterGuest();
      }
    } catch (err) {
      console.warn("RiftEntryOverlay connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGuestClick = () => {
    // Start bg audio from this user interaction
    if (typeof ensureBgAudio === "function") {
      ensureBgAudio();
    }

    if (typeof onEnterGuest === "function") {
      onEnterGuest();
    }
  };

  return (
    <div className={overlayClass}>
      <div className="rift-connect-bg-mobile" />
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
            <span className="rift-entry-hud-value">
              Tri-Moon Rift Crystals
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
            <span>
              {" "}
              Awaiting Starkey identity signature bound to $SUPRAWR DNA.
            </span>
          </div>
          <div className="rift-entry-status-line">
            <span className="rift-entry-status-prefix">&gt;</span>
            {isConnecting ? (
              <span>
                Syncing creds across Primal Rift nodes. Handshake in
                progress… <span className="rift-entry-caret" />
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
      </div>
    </div>
  );
}
