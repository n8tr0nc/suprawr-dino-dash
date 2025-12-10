"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../../features/wallet/useWallet";
import { useStats } from "../../../features/stats/useStats";

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
  "Homeworld relay: The SUPRAWR airdrop nears. Those aligned with the Crew will feel the tremor first. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >></a>",
  "Dimensional broadcast: The SUPRAWR airdrop surges through the Rift. Prepare your wallets, Crew. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
  "Command channel: SUPRAWR flows where the data is richest. Keep your telemetry sharp for the airdrop wave. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
  "Rawrion Prime whispers: A great airdrop wave is forming. Only those tracking the burn will ride it. <a href='https://suprawr.com/airdrop' target='_blank' rel='noopener noreferrer'>Learn more >>",
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
  } = useWallet();

  const { loadingBalances, loadingAccess } = useStats();

  const [walletInstalled, setWalletInstalled] = useState(false);

  // Detect if Starkey is installed AFTER mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasStarkey =
      "starkey" in window && !!window.starkey?.supra;

    setWalletInstalled(hasStarkey);
  }, []);

  const handleClick = async () => {
    if (connected) {
      await disconnect();
    } else {
      await connect();
    }
  };

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
  }, [messageIndex, phase]);

  // Visible -> glitch -> next message cycle
  useEffect(() => {
    if (phase !== "visible") return;

    const visibleTimeout = setTimeout(() => {
      setPhase("glitch");
      const glitchTimeout = setTimeout(() => {
        setMessageIndex((prev) => getNextIndex(prev));
        setPhase("typing");
      }, 550); // glitch duration

      return () => clearTimeout(glitchTimeout);
    }, MESSAGE_VISIBLE_MS);

    return () => clearTimeout(visibleTimeout);
  }, [phase]);

  return (
    <div className="top-bar">
      {/* LEFT: logo + title */}
      <div className="top-left">
        <div className="top-logo-wrap">
          <img
            src="/suprawr001.webp"
            alt="Suprawr Dino"
            className="top-logo"
          />
        </div>
        <div className="top-title-block">
          <div className="top-title-main">// SUPRAWR DINO DASH //</div>
          <div className="top-title-sub">
            Supra gas telemetry for on-chain dino degenerates.
          </div>
        </div>
      </div>

      {/* CENTER: homeworld broadcast */}
      <div className="top-center">
        <div className="top-message-strip">
          <div className="top-message-noise" />
          <div className="top-message-glow" />
          <div className="top-message-inner">
            <span className="top-message-icon" />
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
