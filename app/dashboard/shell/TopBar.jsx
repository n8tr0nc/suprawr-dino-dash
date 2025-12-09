"use client";

import React, { useEffect, useState } from "react";
import { useAccess } from "../../../features/access/useAccess";

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
  "Command channel: Remember — data first, vibes second, fun always.",
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

export default function TopBar({ onToggleSidebar, onOpenRankModal }) {
  const {
    connected,
    address,
    connect,
    disconnect,
    loadingBalances,
    loadingAccess,
  } = useAccess();

  const handleClick = async () => {
    if (connected) {
      await disconnect();
    } else {
      await connect();
    }
  };

  // Detect if Starkey is installed
  const walletInstalled =
    typeof window !== "undefined" &&
    "starkey" in window &&
    !!window.starkey?.supra;

  const label = connected
    ? "Disconnect"
    : walletInstalled
    ? "Connect Starkey Wallet"
    : "Install Starkey Wallet";

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
          <span className="top-message-prefix">RAWRION PRIME // LINK:</span>
          <span
            className={
              "top-message-text" +
              (phase === "glitch" ? " top-message-text--blur-out" : "")
            }
            dangerouslySetInnerHTML={{ __html: displayedText }}
          ></span>
          {phase === "typing" && <span className="top-message-caret" />}
        </div>
      </div>

      {/* RIGHT: burger + wallet controls */}
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
