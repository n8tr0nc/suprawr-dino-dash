"use client";

import React, { useEffect, useState, useRef } from "react";
import { useWallet } from "../../features/wallet/useWallet";
import { useStats } from "../../features/stats/useStats";

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
  const { connected, address } = useWallet();
  const { accessTier, loadingBalances } = useStats();

  const currentTier = accessTier || null;
  const rankBadgeSrc = currentTier ? getRankBadgePath(currentTier) : null;

  // Short form for modal button (same format as top bar)
  const modalWalletShort =
    address && connected
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : "";

  const isRankLoaded = !!(rankBadgeSrc && currentTier);

  // Sidebar open/close (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Rift entry terminal + FX
  const [showEntryOverlay, setShowEntryOverlay] = useState(true);
  const [showRiftFx, setShowRiftFx] = useState(false);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);

  // Rank modal state
  const [showRankModal, setShowRankModal] = useState(false);
  const [isRankModalExiting, setIsRankModalExiting] = useState(false);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isInfoModalExiting, setIsInfoModalExiting] = useState(false);

  // Refs to manage exit animation timers so they don’t pile up
  const rankModalTimerRef = useRef(null);
  const infoModalTimerRef = useRef(null);

  // --------------------------
  // Disable body scroll when any full-screen modal is open
  // --------------------------
  useEffect(() => {
    const hasAnyModal =
      showRankModal ||
      isRankModalExiting ||
      showInfoModal ||
      isInfoModalExiting ||
      showEntryOverlay;

    if (hasAnyModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [
    showRankModal,
    isRankModalExiting,
    showInfoModal,
    isInfoModalExiting,
    showEntryOverlay,
  ]);

  // --------------------------
  // Sidebar toggle handlers
  // --------------------------
  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  // --------------------------
  // Entry overlay “enter guest”
  // --------------------------
  const handleEnterGuest = () => {
    setHasEnteredOnce(true);
    setShowEntryOverlay(false);
    setShowRiftFx(true);

    setTimeout(() => setShowRiftFx(false), 700);
  };

  // --------------------------
  // Rank modal open
  // --------------------------
  const handleOpenRankModal = () => {
    if (rankModalTimerRef.current) {
      clearTimeout(rankModalTimerRef.current);
      rankModalTimerRef.current = null;
    }

    setIsRankModalExiting(false);
    setShowRankModal(true);
  };

  // --------------------------
  // Rank modal close (with exit animation)
// --------------------------
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

  // --------------------------
  // Info modal open
  // --------------------------
  const handleOpenInfoModal = () => {
    if (infoModalTimerRef.current) {
      clearTimeout(infoModalTimerRef.current);
      infoModalTimerRef.current = null;
    }

    setIsInfoModalExiting(false);
    setShowInfoModal(true);
  };

  // --------------------------
  // Info modal close (with exit animation)
  // --------------------------
  const handleCloseInfoModal = () => {
    if (!showInfoModal) return;

    setIsInfoModalExiting(true);

    if (infoModalTimerRef.current) {
      clearTimeout(infoModalTimerRef.current);
    }

    infoModalTimerRef.current = setTimeout(() => {
      setShowInfoModal(false);
      setIsInfoModalExiting(false);
      infoModalTimerRef.current = null;
    }, MODAL_ANIM_MS);
  };

  // --------------------------
  // Shell CSS classes
  // --------------------------
  const dashboardShellClass = `dashboard-shell${
    showRiftFx ? " dashboard-shell--rift-fx" : ""
  }`;

  const rankModalClass = `modal-001-overlay${
    showRankModal ? " modal-001-overlay--visible" : ""
  }${isRankModalExiting ? " modal-001-overlay--exiting" : ""}`;

  const infoModalClass = `modal-001-overlay${
    showInfoModal ? " modal-001-overlay--visible" : ""
  }${isInfoModalExiting ? " modal-001-overlay--exiting" : ""}`;

  // --------------------------
  // Content
  // --------------------------
  return (
    <div className="dashboard-root">
      {/* Rift entry overlay */}
      <OverlayRoot
        showEntryOverlay={showEntryOverlay}
        handleEnterGuest={handleEnterGuest}
      />

      {/* Dashboard Shell */}
      <div className={dashboardShellClass}>
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onOpenRankModal={handleOpenRankModal}
        />

        <main className="dashboard-main">
          <TopBar
            onToggleSidebar={handleToggleSidebar}
            onOpenRankModal={handleOpenRankModal}
          />

          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <h1 className="dashboard-title">
                // SUPRAWR DINO DASH · GAS TRACKER //
              </h1>
              <p className="dashboard-subtitle">
                Track your Supra coin ($SUPRA) gas fees and lifetime activity
                with this experimental telemetry console. Dino Dash is a
                community-built tool and not affiliated with Supra Labs.
              </p>
            </div>

            <div className="dashboard-header-right">
              <button
                type="button"
                className="info-badge-button"
                onClick={handleOpenInfoModal}
              >
                <span className="info-badge-icon">?</span>
                <span className="info-badge-text">How gas tracking works</span>
              </button>

              <div className="header-rank-pill">
                <div className="header-rank-label">Holder Tier</div>
                <div className="header-rank-content">
                  {isRankLoaded ? (
                    <>
                      <button
                        type="button"
                        className="header-rank-badge-button"
                        onClick={handleOpenRankModal}
                      >
                        <img
                          src={rankBadgeSrc}
                          alt={currentTier || "Current rank"}
                          className="header-rank-badge-img"
                        />
                      </button>
                      <div className="header-rank-text">
                        <div className="header-rank-tier">
                          {currentTier || "Hatchling"}
                        </div>
                        <div className="header-rank-wallet">
                          {modalWalletShort || "No wallet connected"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="header-rank-loading">
                      {loadingBalances
                        ? "Loading rank telemetry…"
                        : "Connect wallet to load rank."}
                    </div>
                  )}
                </div>
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
                className="dashboard-text-link"
              >
                <span>// SUPRAWR HOME //</span>
              </a>

              <a
                href="https://t.me/suprawr"
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-text-link"
              >
                <span>// JOIN THE RAWRPACK //</span>
              </a>

              <a
                href="https://x.com/suprawrdino"
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-text-link"
              >
                <span>// X: @SUPRAWRDINO //</span>
              </a>

              <a
                href="https://supra.com"
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-text-link"
              >
                <span>// SUPRA LABS //</span>
              </a>
            </div>
          </section>
        </main>
      </div>

      {/* Rank Modal */}
      {showRankModal || isRankModalExiting ? (
        <div className={rankModalClass} onClick={handleCloseRankModal}>
          <div
            className="modal-001-container"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-001-header">
              <div className="modal-001-title-block">
                <h2 className="modal-001-title">// HOLDER RANK OVERLAY //</h2>
                <p className="modal-001-subtitle">
                  This is a lore-first ranking system for $SUPRAWR holders and
                  early Dino Dash participants.
                </p>
              </div>
              <button
                type="button"
                className="modal-001-close"
                onClick={handleCloseRankModal}
              >
                ×
              </button>
            </header>

            <div className="modal-001-body rank-modal-body">
              <div className="rank-modal-left">
                <div className="rank-modal-card">
                  <div className="rank-modal-card-header">
                    <div className="rank-modal-label">CURRENT HOLDER TIER</div>
                  </div>

                  <div className="rank-modal-current-rank">
                    {isRankLoaded ? (
                      <>
                        <img
                          src={rankBadgeSrc}
                          alt={currentTier || "Current rank"}
                          className="rank-modal-badge-img"
                        />
                        <div className="rank-modal-rank-text">
                          <div className="rank-modal-rank-name">
                            {currentTier || "Hatchling"}
                          </div>
                          <div className="rank-modal-rank-wallet">
                            {modalWalletShort ||
                              "Connect your Starkey wallet to view rank."}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rank-modal-rank-text">
                        <div className="rank-modal-rank-name">
                          Rank not loaded
                        </div>
                        <div className="rank-modal-rank-wallet">
                          Connect your Starkey wallet and reload telemetry to
                          see your tier.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rank-modal-note">
                    Rank tiers are based on estimated $SUPRAWR balance snapshots
                    and may shift as Dino Dash evolves. This is a community
                    experiment — not a promise of any specific utility.
                  </div>
                </div>
              </div>

              <div className="rank-modal-right">
                <div className="rank-modal-card rank-modal-card--tiers">
                  <div className="rank-modal-card-header">
                    <div className="rank-modal-label">TIER BREAKDOWN</div>
                  </div>

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
                        1,000,000 – 9,999,999 $SUPRAWR
                      </span>
                    </li>

                    <li
                      className={`tier-list-item${
                        currentTier === "Guardian" ? " current-tier" : ""
                      }`}
                    >
                      <span className="tier-name">Guardian</span>
                      <span className="tier-range">
                        100,000 – 999,999 $SUPRAWR
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
          </div>
        </div>
      ) : null}

      {/* Info Modal */}
      {showInfoModal || isInfoModalExiting ? (
        <div className={infoModalClass} onClick={handleCloseInfoModal}>
          <div
            className="modal-001-container"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-001-header">
              <div className="modal-001-title-block">
                <h2 className="modal-001-title">
                  // HOW GAS TRACKING WORKS //
                </h2>
              </div>
              <button
                type="button"
                className="modal-001-close"
                onClick={handleCloseInfoModal}
              >
                ×
              </button>
            </header>

            <div className="modal-001-body gas-info-body">
              <p>
                This tool estimates gas spent on{" "}
                <strong>coin ($SUPRA) transactions only</strong> for your
                connected wallet using Supra’s public RPC.
              </p>
              <p>
                It uses the <code>coin_transactions</code> endpoint and may
                exclude contract-only or system-level activity shown in some
                explorers. When <code>gas_used</code> is unavailable, this tool
                falls back to the RPC’s own fee fields instead of guessing from
                <code>max_gas_amount × gas_unit_price</code>.
              </p>
              <p>
                There is currently{" "}
                <strong>
                  no public RPC method that returns full gas details for every
                  transaction type
                </strong>{" "}
                across Supra. The only place that data exists is inside the full
                transaction detail, which Supra RPC currently does not expose
                via a public “fetch by hash” endpoint.
              </p>
              <p>
                Because of that limitation, this dashboard focuses on{" "}
                <strong>coin ($SUPRA) transactions</strong> and surfaces
                human-readable, wallet-level fee telemetry. It is meant as a
                community-built experiment, not a canonical source of truth.
              </p>
              <p>
                As Supra’s RPC and ecosystem evolve, this tool will adapt to
                include richer data and more transaction types when they become
                reliably available on-chain via public infra.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
