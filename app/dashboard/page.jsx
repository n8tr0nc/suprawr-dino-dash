"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useWallet } from "../features/wallet/useWallet";
import { useStats } from "../features/stats/useStats";

import OverlayRoot from "./shell/overlays/OverlayRoot";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import GasTracker from "../features/gas-tracker/GasTracker";

import "./styles/dashboard-shell.css";
import "./styles/modals.css";

const MODAL_ANIM_MS = 500;
const BG_BASE_VOLUME = 0.35;

// --------------------------
// Rank badge resolver
// --------------------------
function getRankBadgePath(tier) {
  switch (tier) {
    case "Hatchling":
      return "/rank/hatchling-001.webp";
    case "Scaleborn":
      return "/rank/scaleborn-001.webp";
    case "Guardian":
      return "/rank/guardian-001.webp";
    case "Titan":
      return "/rank/titan-001.webp";
    case "Master":
      return "/rank/master-001.webp";
    default:
      return null;
  }
}

export default function Page() {
  const { connected, address } = useWallet();
  const { accessTier, loadingBalances } = useStats();

  const currentTier = accessTier || null;
  const rankBadgeSrc = currentTier ? getRankBadgePath(currentTier) : null;
  const isRankLoaded = !!(rankBadgeSrc && currentTier);

  const modalWalletShort =
    address && connected
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : "";

  // Sidebar open/close (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Rift entry terminal + FX
  const [showEntryOverlay, setShowEntryOverlay] = useState(true);
  const [showRiftFx, setShowRiftFx] = useState(false);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);

  // Rank modal
  const [showRankModal, setShowRankModal] = useState(false);
  const [isRankModalExiting, setIsRankModalExiting] = useState(false);
  const rankModalTimerRef = useRef(null);

  // --------------------------
  // Background audio
  // --------------------------
  const bgAudioRef = useRef(null);
  const bgStartedRef = useRef(false);
  const fadeIntervalRef = useRef(null);
  const [isBgMuted, setIsBgMuted] = useState(false);

  // --------------------------
  // NEW: Global SFX mute
  // --------------------------
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Init bg audio
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!bgAudioRef.current) {
      const audio = new Audio("/audio/bg-001.mp3");
      audio.loop = true;
      audio.volume = 0;
      bgAudioRef.current = audio;
    }

    return () => {
      const audio = bgAudioRef.current;
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };
  }, []);

  // Fade-in bg audio on start
  const ensureBgAudio = useCallback(() => {
    if (bgStartedRef.current) return;
    const audio = bgAudioRef.current;
    if (!audio) return;

    bgStartedRef.current = true;
    audio.volume = 0;

    audio
      .play()
      .then(() => {
        const target = isBgMuted ? 0 : BG_BASE_VOLUME;

        if (fadeIntervalRef.current)
          clearInterval(fadeIntervalRef.current);

        const step = 0.05;
        const interval = window.setInterval(() => {
          const a = bgAudioRef.current;
          if (!a) {
            clearInterval(interval);
            fadeIntervalRef.current = null;
            return;
          }
          const diff = target - a.volume;
          if (diff <= 0) {
            a.volume = target;
            clearInterval(interval);
            fadeIntervalRef.current = null;
            return;
          }
          a.volume = Math.min(target, a.volume + step);
        }, 80);

        fadeIntervalRef.current = interval;
      })
      .catch(() => {
        bgStartedRef.current = false;
      });
  }, [isBgMuted]);

  // Fade mute/unmute
  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current)
      clearInterval(fadeIntervalRef.current);

    const target = isBgMuted ? 0 : BG_BASE_VOLUME;
    const step = 0.05;

    const interval = window.setInterval(() => {
      const a = bgAudioRef.current;
      if (!a) {
        clearInterval(interval);
        fadeIntervalRef.current = null;
        return;
      }
      const diff = target - a.volume;
      if (Math.abs(diff) <= step) {
        a.volume = target;
        clearInterval(interval);
        fadeIntervalRef.current = null;
        return;
      }
      a.volume = Math.max(
        0,
        Math.min(1, a.volume + Math.sign(diff) * step)
      );
    }, 80);

    fadeIntervalRef.current = interval;

    return () => {
      if (fadeIntervalRef.current)
        clearInterval(fadeIntervalRef.current);
    };
  }, [isBgMuted]);

  const handleToggleBgMute = () =>
    setIsBgMuted((v) => !v);
  const handleToggleSfxMute = () =>
    setIsSfxMuted((v) => !v);

  // Stop bg music when disconnect
  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio) return;
    if (!connected) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      bgStartedRef.current = false;
    }
  }, [connected]);

  const handleEnterGuest = () => {
    setHasEnteredOnce(true);
    setShowEntryOverlay(false);
    setShowRiftFx(true);
    setTimeout(() => setShowRiftFx(false), 700);
  };

  const handleOpenRankModal = () => {
    if (rankModalTimerRef.current)
      clearTimeout(rankModalTimerRef.current);

    setIsRankModalExiting(false);
    setShowRankModal(true);
  };

  const handleCloseRankModal = () => {
    if (!showRankModal) return;

    setIsRankModalExiting(true);

    if (rankModalTimerRef.current)
      clearTimeout(rankModalTimerRef.current);

    rankModalTimerRef.current = setTimeout(() => {
      setShowRankModal(false);
      setIsRankModalExiting(false);
      rankModalTimerRef.current = null;
    }, MODAL_ANIM_MS);
  };

  const handleToggleSidebar = () =>
    setIsSidebarOpen((v) => !v);

  useEffect(() => {
    if (!connected && hasEnteredOnce) {
      setShowEntryOverlay(true);
    }
  }, [connected, hasEnteredOnce]);

  useEffect(() => {
    return () => {
      if (rankModalTimerRef.current)
        clearTimeout(rankModalTimerRef.current);
    };
  }, []);

  const shellCls = `dashboard-shell${
    showEntryOverlay ? " dashboard-shell--hidden" : ""
  }`;

  return (
    <div className="dashboard-root">
      <OverlayRoot
        showEntryOverlay={showEntryOverlay}
        handleEnterGuest={handleEnterGuest}
        showRiftFx={showRiftFx}
        ensureBgAudio={ensureBgAudio}
        isSfxMuted={isSfxMuted} // NEW
      />

      <div className={shellCls}>
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onOpenRankModal={handleOpenRankModal}
          isSfxMuted={isSfxMuted} // NEW
        />

        {isSidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="dashboard-main">
          <TopBar
            onToggleSidebar={handleToggleSidebar}
            onOpenRankModal={handleOpenRankModal}
            isBgMuted={isBgMuted}
            onToggleBgMute={handleToggleBgMute}
            isSfxMuted={isSfxMuted}         // NEW
            onToggleSfxMute={handleToggleSfxMute} // NEW
          />

          <GasTracker isSfxMuted={isSfxMuted} />

          <section className="dashboard-panel panel-25">
            <div className="dashboard-panel-body">
              <a
                href="https://suprawr.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/poster-airdrop-004.webp"
                  className="poster-001"
                  alt="SUPRAWR Airdrop Poster"
                />
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* Rank Modal — unchanged except props flow */}
      {showRankModal && (
        <div
          className={`modal-001-overlay rank-modal-overlay${
            isRankModalExiting ? " modal-001-overlay--exiting" : ""
          }`}
          onClick={handleCloseRankModal}
        >
          <div
            className="modal-001 rank-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-001-header">
              <h3 className="modal-001-title"> </h3>
              <button
                type="button"
                className="modal-001-close"
                onClick={handleCloseRankModal}
              >
                ×
              </button>
            </div>

            <div className="modal-001-body">
              <div className="rank-modal-badge-wrap">
                {loadingBalances && connected ? (
                  <div className="rank-modal-orbit-skeleton" />
                ) : isRankLoaded ? (
                  <img
                    src={rankBadgeSrc}
                    alt={currentTier}
                    className="rank-modal-badge"
                  />
                ) : (
                  <div className="rank-modal-orbit-skeleton" />
                )}
              </div>

              {loadingBalances && connected ? (
                <div className="rank-modal-tier-name-skeleton" />
              ) : isRankLoaded ? (
                <div className="rank-modal-tier-name">
                  {currentTier}
                </div>
              ) : (
                <div className="rank-modal-tier-name-skeleton" />
              )}

              {connected && modalWalletShort && (
                <div className="rank-modal-wallet">
                  <span
                    className="rank-modal-wallet-address"
                    title="Copy wallet address"
                    onClick={() =>
                      navigator.clipboard.writeText(address)
                    }
                  >
                    {modalWalletShort}
                  </span>
                </div>
              )}

              <p>
                Your rank is based on your total $SUPRAWR holdings. Higher
                tiers unlock more features inside DinoDash.
              </p>

              <ul className="tier-list">
                <li
                  className={`tier-list-item${
                    currentTier === "Master" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Master</span>
                  <span className="tier-range">
                    10,000,000+ $SUPRAWR
                  </span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Titan" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Titan</span>
                  <span className="tier-range">
                    1,000,000+ $SUPRAWR
                  </span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Guardian" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Guardian</span>
                  <span className="tier-range">
                    100,000+ $SUPRAWR
                  </span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Scaleborn" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Scaleborn</span>
                  <span className="tier-range">
                    1,000+ $SUPRAWR
                  </span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Hatchling" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Hatchling</span>
                  <span className="tier-range">
                    below 1,000 $SUPRAWR
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
