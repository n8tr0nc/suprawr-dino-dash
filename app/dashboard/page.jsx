"use client";

import React, { useEffect, useState } from "react";
import { useAccess } from "../../features/access/useAccess";

import OverlayRoot from "./shell/overlays/OverlayRoot";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import GasTracker from "../../features/gas-tracker/GasTracker";

import "./styles/dashboard-shell.css";
import "./styles/modals.css";

export default function Page() {
  const { connected, accessTier } = useAccess();
  const currentTier = accessTier || null;

  // Sidebar open/close (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Rift entry terminal + FX
  const [showEntryOverlay, setShowEntryOverlay] = useState(true);
  const [showRiftFx, setShowRiftFx] = useState(false);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);

  // Rank modal
  const [showRankModal, setShowRankModal] = useState(false);

  // When user enters via terminal (guest or wallet), close overlay and fire FX
  const handleEnterGuest = () => {
    setHasEnteredOnce(true);
    setShowEntryOverlay(false);
    setShowRiftFx(true);

    // Fade out the red burst FX after a short delay
    setTimeout(() => {
      setShowRiftFx(false);
    }, 700);
  };

  // Sidebar toggle (used by TopBar on mobile)
  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // When the wallet disconnects AFTER the user has entered once,
  // bring back the terminal overlay.
  useEffect(() => {
    if (!connected && hasEnteredOnce) {
      setShowEntryOverlay(true);
    }
  }, [connected, hasEnteredOnce]);

  return (
    <div className="dashboard-root">
      {/* Overlay stack: Rift terminal + FX */}
      <OverlayRoot
        showEntryOverlay={showEntryOverlay}
        handleEnterGuest={handleEnterGuest}
        showRiftFx={showRiftFx}
      />

      {/* Main dashboard shell (visible even if overlay is on top) */}
      <div className="dashboard-shell">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onOpenRankModal={() => setShowRankModal(true)}
        />

        <div className="dashboard-main">
          <TopBar onToggleSidebar={handleToggleSidebar} />
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <div>
                <h1 className="dashboard-title">
                  <span className="gas-icon">⛽︎</span> GAS TRACKER
                </h1>
                <p className="dashboard-subtitle">
                  Track how much gas your Supra wallet has spent.
                </p>
              </div>
            </div>
          </header>
          <GasTracker />
          <section className="dashboard-panel panel-25">
            <div className="dashboard-panel-body">
              <a href="https://suprawr.com" target="_blank" rel="noopener noreferrer">
                <img src="/poster-airdrop-004.webp" title="Click to learn more!" className="poster-001" />
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* Rank modal, driven by Sidebar's rank button */}
      {showRankModal && (
        <div
          className="modal-001-overlay rank-modal-overlay"
          onClick={() => setShowRankModal(false)}
        >
          <div
            className="modal-001 rank-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-001-header">
              <h3 className="modal-001-title">Holder Rank Info</h3>
              <button
                type="button"
                className="modal-001-close"
                onClick={() => setShowRankModal(false)}
                aria-label="Close rank info"
              >
                ×
              </button>
            </div>
                        <div className="modal-001-body">
              <p>
                Your rank is based on your total $SUPRAWR holdings. Higher
                tiers unlock more features and future modules inside Dino Dash.
              </p>

              {/* Current tier display */}
              <div className="tier-current">
                Current tier: <span className="tier-current-name">{currentTier || "No rank yet"}</span>
              </div>

              {/* Left/right aligned tier list with highlight */}
              <ul className="tier-list">
                <li
                  className={
                    "tier-list-item" +
                    (currentTier === "Primal Master" ? " current-tier" : "")
                  }
                >
                  <span className="tier-name">Primal Master</span>
                  <span className="tier-range">10,000,000+ $SUPRAWR</span>
                </li>

                <li
                  className={
                    "tier-list-item" +
                    (currentTier === "Primal Titan" ? " current-tier" : "")
                  }
                >
                  <span className="tier-name">Primal Titan</span>
                  <span className="tier-range">1,000,000+ $SUPRAWR</span>
                </li>

                <li
                  className={
                    "tier-list-item" +
                    (currentTier === "Primal Guardian" ? " current-tier" : "")
                  }
                >
                  <span className="tier-name">Primal Guardian</span>
                  <span className="tier-range">100,000+ $SUPRAWR</span>
                </li>

                <li
                  className={
                    "tier-list-item" +
                    (currentTier === "Scaleborn" ? " current-tier" : "")
                  }
                >
                  <span className="tier-name">Scaleborn</span>
                  <span className="tier-range">1,000+ $SUPRAWR</span>
                </li>

                <li
                  className={
                    "tier-list-item" +
                    (currentTier === "Hatchling" ? " current-tier" : "")
                  }
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
