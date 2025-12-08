"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAccess } from "../../features/access/useAccess";

import OverlayRoot from "./shell/overlays/OverlayRoot";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import GasTracker from "../../features/gas-tracker/GasTracker";

import "./styles/dashboard-shell.css";
import "./styles/modals.css";

const MODAL_ANIM_MS = 500;

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
  const { connected, accessTier, address } = useAccess(); 

  const currentTier = accessTier || null;
  const rankBadgeSrc = currentTier ? getRankBadgePath(currentTier) : null;

  // Short form for modal button (same format as top bar)
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

  // ---------------------------------------
  // Entry overlay (guest or wallet enter)
  // ---------------------------------------
  const handleEnterGuest = () => {
    setHasEnteredOnce(true);
    setShowEntryOverlay(false);
    setShowRiftFx(true);

    setTimeout(() => setShowRiftFx(false), 700);
  };

  // ---------------------------------------
  // Rank modal open
  // ---------------------------------------
  const handleOpenRankModal = () => {
    if (rankModalTimerRef.current) {
      clearTimeout(rankModalTimerRef.current);
      rankModalTimerRef.current = null;
    }

    setIsRankModalExiting(false);
    setShowRankModal(true);
  };

  // ---------------------------------------
  // Rank modal close (with exit animation)
  // ---------------------------------------
  const handleCloseRankModal = () => {
    if (!showRankModal) return;

    setIsRankModalExiting(true);

    if (rankModalTimerRef.current) {
      clearTimeout(rankModalTimerRef.current);
    }

    rankModalTimerRef.current = setTimeout(() => {
      setShowRankModal(false);
      setIsRankModalExiting(false);
      rankModalTimerRef.current = null;
    }, MODAL_ANIM_MS);
  };

  const handleToggleSidebar = () =>
    setIsSidebarOpen((prev) => !prev);

  // Restore overlay if wallet disconnects AFTER entry
  useEffect(() => {
    if (!connected && hasEnteredOnce) {
      setShowEntryOverlay(true);
    }
  }, [connected, hasEnteredOnce]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (rankModalTimerRef.current) {
        clearTimeout(rankModalTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="dashboard-root">
      {/* Rift entry overlay */}
      <OverlayRoot
        showEntryOverlay={showEntryOverlay}
        handleEnterGuest={handleEnterGuest}
        showRiftFx={showRiftFx}
      />

      {/* Dashboard Shell */}
      <div className="dashboard-shell">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onOpenRankModal={handleOpenRankModal}
          rankBadge={rankBadgeSrc} // still passed through if needed later
          rankName={currentTier}
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
          />

          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <div>
                <h1 className="dashboard-title">
                  <span className="gas-icon">⛽︎</span> GAS TRACKER
                </h1>
                <p className="dashboard-subtitle">
                  Track your gas spending on your Supra wallet and get other useful fee telemetry.
                </p>
              </div>
            </div>
          </header>

          <GasTracker />

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
                />
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* Rank Modal */}
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
              {/* RANK BADGE AT TOP */}
              {rankBadgeSrc && (
                <div className="rank-modal-badge-wrap">
                  <img
                    src={rankBadgeSrc}
                    alt={currentTier}
                    className="rank-modal-badge"
                  />
                </div>
              )}

              {currentTier && (
                <div className="rank-modal-tier-name">
                  {currentTier}
                </div>
              )}

              {/* CONNECTED WALLET UNDER RANK */}
              {connected && modalWalletShort && (
                <div className="rank-modal-wallet">
                  <span
                    className="rank-modal-wallet-address"
                    title="Copy wallet address"
                    onClick={() => navigator.clipboard.writeText(address)}
                  >
                    {modalWalletShort}
                  </span>
                </div>
              )}

              <p>
                Your rank is based on your total $SUPRAWR holdings.
                Higher tiers unlock more features inside DinoDash.
              </p>

              <ul className="tier-list">
                <li
                  className={`tier-list-item${
                    currentTier === "Master" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Master</span>
                  <span className="tier-range">10,000,000+ $SUPRAWR</span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Titan" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Titan</span>
                  <span className="tier-range">1,000,000+ $SUPRAWR</span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Guardian" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Guardian</span>
                  <span className="tier-range">100,000+ $SUPRAWR</span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Scaleborn" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Scaleborn</span>
                  <span className="tier-range">1,000+ $SUPRAWR</span>
                </li>

                <li
                  className={`tier-list-item${
                    currentTier === "Hatchling" ? " current-tier" : ""
                  }`}
                >
                  <span className="tier-name">Hatchling</span>
                  <span className="tier-range">below 1,000 $SUPRAWR</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
