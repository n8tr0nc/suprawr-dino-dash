"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../features/wallet/useWallet";
import { useStats } from "../../features/stats/useStats";

// ----------------------------------------
// Homeworld broadcast messages
// ----------------------------------------

const HOMEWORLD_MESSAGES = [
  "Rawrion Prime reports: Rift-layer stability nominal. Continue data collection.",
  "Homeworld relay: Supra flux is rising across the D-88 cluster. Stay synced.",
  "Command to RAWRpack: Every tx you track strengthens our telemetry grid.",
  "Signal from Homeworld: Do not fear the gas. Understand it. Bend it.",
  "Beacon ping: New Supra routes opening beyond the Rift. Map them, Crew.",
  "Mission log: Your wallet is a sensor. Dino Dash is the instrument.",
  "Rawrion Prime: Remember, small fees over eons carve new realities.",
  "Homeworld advisory: Trust data, question noise, ignore chain drama.",
  "Dimensional echo: Another chain collapsed today. Supra still rawrs.",
  "Telemetry core: We see your sync from orbit. Readings look crispy.",
  "Rift notice: High-energy tx storm detected. Perfect time to test tools.",
  "Command whisper: Those who track the burn, shape the next era.",
  "Homeworld feed: Supra’s heartbeat is clean. Keep listening, RAWRpack.",
  "Rawrion Prime to Dino Dash: Your HUD is now part of our nav network.",
  "Signal shard: Somewhere, a future dino thanks you for this telemetry.",
  "Dimensional broadcast: Every synced wallet is another sensor online.",
  "Command channel: Remember — data first, vibes second, rawr always.",
  "Homeworld ping: The void is vast. Your address is not lost in it.",
  "Rift relay: Supra gas flows like magma. You’re mapping the lava.",
  "Rawrion Prime closing note: When in doubt, sync the Rift and proceed.",
  "Homeworld relay: The SUPRAWR airdrop nears. Those aligned with the Rift will feast first. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >></a>",
  "Dimensional broadcast: The SUPRAWR airdrop surges through the Rift. Prepare your wallets, Crew. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
  "Command channel: SUPRAWR flows where the data is richest. Keep tracking, RAWRpack. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
  "Rawrion Prime whispers: A great airdrop wave is forming. Only the synced will catch it. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
];

const MESSAGE_VISIBLE_MS = 10_000; // 10 seconds
const TYPE_INTERVAL_MS = 35; // ms per character

function getNextIndex(prev) {
  if (HOMEWORLD_MESSAGES.length <= 1) return 0;
  let next = prev;
  while (next === prev) {
    next = Math.floor(Math.random() * HOMEWORLD_MESSAGES.length);
  }
  return next;
}

export default function TopBar({
  onToggleSidebar,
  onOpenRankModal,
  isBgMuted,
  onToggleBgMute,
  isSfxMuted,      // NEW
  onToggleSfxMute, // NEW
}) {
  
  const { connected, address, connect, disconnect, walletInstalled, providerReady } = useWallet();
  const { loadingBalances, loadingAccess } = useStats();

  const handleClick = async () => {
    if (connected) {
      await disconnect();
    } else {
      await connect();
    }
  };

  let label = "";
  if (connected) {
    label = "Disconnect";
  } else if (!providerReady) {
    label = "Detecting Wallet…";
  } else if (!walletInstalled) {
    label = "Install Starkey Wallet";
  } else {
    label = "Connect Starkey Wallet";
  }

  const short = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  const disabled = !connected && (loadingBalances || loadingAccess);

  // ----------------------------------------
  // Homeworld broadcast state
  // ----------------------------------------

  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * HOMEWORLD_MESSAGES.length)
  );
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState("typing"); // "typing" | "visible" | "glitch"

  // Typewriter effect
  useEffect(() => {
    if (phase !== "typing") return;

    const full = HOMEWORLD_MESSAGES[messageIndex] || "";
    let i = 0;
    setDisplayedText("");

    const id = setInterval(() => {
      i += 1;
      setDisplayedText(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(id);
        setPhase("visible");
      }
    }, TYPE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [phase, messageIndex]);

  // Visible duration
  useEffect(() => {
    if (phase !== "visible") return;

    const timeoutId = setTimeout(() => {
      setPhase("glitch");
    }, MESSAGE_VISIBLE_MS);

    return () => clearTimeout(timeoutId);
  }, [phase]);

  // After blur-out, rotate to next message
  const handleGlitchAnimationEnd = () => {
    if (phase !== "glitch") return;
    setMessageIndex((prev) => getNextIndex(prev));
    setDisplayedText("");
    setPhase("typing");
  };

  const handleAudioToggleClick = () => {
    if (typeof onToggleBgMute === "function") {
      onToggleBgMute();
    }
  };

  const handleSfxToggleClick = () => {
    if (typeof onToggleSfxMute === "function") {
      onToggleSfxMute();
    }
  };

  return (
    <div className="top-right-bar">
      {/* LEFT: Homeworld broadcast */}
      <div className="top-message-wrapper">
        <div
          className={
            "top-message-strip" +
            (phase === "glitch" ? " top-message-strip--glitch" : "")
          }
          onAnimationEnd={handleGlitchAnimationEnd}
        >
          <img
            src="/link-001.webp"
            alt="link icon"
            className="top-message-icon"
          />
          <span className="top-message-prefix">
            RAWRION PRIME // LINK:
          </span>
          <span
            className={
              "top-message-text" +
              (phase === "glitch"
                ? " top-message-text--blur-out"
                : "")
            }
            dangerouslySetInnerHTML={{ __html: displayedText }}
          ></span>
          {phase === "typing" && (
            <span className="top-message-caret" />
          )}
        </div>
      </div>

      {/* RIGHT: burger + SFX + music + wallet controls */}
      <div className="top-right-controls">
        {onToggleSidebar && (
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={onToggleSidebar}
          >
            ☰
          </button>
        )}

        <div className="top-right-audio-group">
          {/* NEW: SFX mute toggle (left of music button) */}
          <button
            type="button"
            className={
              "top-right-audio-toggle" +
              (isSfxMuted ? " top-right-audio-toggle--muted" : "")
            }
            onClick={handleSfxToggleClick}
            aria-label={
              isSfxMuted ? "Unmute sound effects" : "Mute sound effects"
            }
          >
            <span className="top-right-audio-indicator">
              <svg
                className="top-right-audio-icon"
                viewBox="0 0 128 128"
                aria-hidden="true"
                focusable="false"
              >
                {/* From your Sound_waves SVG: icon:4 */}
                <path d="M24.7 42.6H0V31.9h24.7v10.7zm0 2.7H0V56h24.7V45.3zm0 13.4H0v10.7h24.7V58.7zm0 13.3H0v10.7h24.7V72zm0 13.4H0v10.7h24.7V85.4zm69.8-40.1H69.8V56h24.7V45.3zm0 13.4H69.8v10.7h24.7V58.7zm0 13.3H69.8v10.7h24.7V72zm0 13.4H69.8v10.7h24.7V85.4zM128 72h-24.7v10.7H128V72zm0 13.4h-24.7v10.7H128V85.4zM59.6 58.7H34.9v10.7h24.7V58.7zm0 13.3H34.9v10.7h24.7V72zm0 13.4H34.9v10.7h24.7V85.4z" />
              </svg>
            </span>
          </button>

          {/* Existing background music toggle */}
          <button
            type="button"
            className={
              "top-right-audio-toggle" +
              (isBgMuted ? " top-right-audio-toggle--muted" : "")
            }
            onClick={handleAudioToggleClick}
            aria-label={
              isBgMuted
                ? "Unmute background audio"
                : "Mute background audio"
            }
          >
            <span className="top-right-audio-indicator">
              <svg
                className="top-right-audio-icon"
                viewBox="0 0 2048 2048"
                aria-hidden="true"
                focusable="false"
              >
                <g>
                  <path d="M1430.7 1228.39c56.217 0 107.118 22.792 143.962 59.635 36.843 36.843 59.634 87.744 59.634 143.962 0 56.217-22.79 107.118-59.634 143.961-36.844 36.845-87.745 59.635-143.962 59.635-56.217 0-107.118-22.79-143.961-59.635-36.844-36.843-59.635-87.744-59.635-143.96 0-56.22 22.79-107.12 59.635-143.963 36.843-36.843 87.744-59.635 143.961-59.635z" />
                  <path d="m1533.79 259.873-.006-.058 30.878-3.429c34.35-3.817 65.42 21.038 69.234 55.39.544 4.912.382 2.479.382 7.058v1081.33c0 34.613-28.08 62.694-62.694 62.694-34.613 0-62.694-28.08-62.694-62.694V388.684l-685.712 76.19v1115.53c0 34.615-28.08 62.694-62.694 62.694-34.613 0-62.694-28.08-62.694-62.694V408.814c0-32.915 25.44-58.884 57.661-62.464l778.34-86.482z" />
                  <path d="M618.439 1382.53c56.531 0 107.717 22.918 144.767 59.968 37.05 37.05 59.968 88.236 59.968 144.767 0 56.531-22.918 107.717-59.968 144.767-37.05 37.049-88.236 59.967-144.767 59.967-56.531 0-107.717-22.918-144.767-59.967-37.049-37.05-59.968-88.235-59.968-144.767 0-56.53 22.92-107.717 59.968-144.767 37.05-37.05 88.235-59.968 144.767-59.968z" />
                </g>
              </svg>
            </span>
          </button>
        </div>

        <div className="top-right-wallet-group">
          {connected && (
            <button
              type="button"
              className="top-right-wallet-address-btn"
              onClick={onOpenRankModal}
              title="View rank details"
            >
              {short}
            </button>
          )}

          <button
            className="top-right-wallet-button"
            onClick={handleClick}
            disabled={disabled}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
