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
  const { connected } = useAccess();

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
          <GasTracker />
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
              <ul className="rank-list">
                <li>Primal Master — 10,000,000+ $SUPRAWR</li>
                <li>Primal Titan — 1,000,000+ $SUPRAWR</li>
                <li>Primal Guardian — 100,000+ $SUPRAWR</li>
                <li>Scaleborn — 1,000+ $SUPRAWR</li>
                <li>Hatchling — below 1,000 $SUPRAWR</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
