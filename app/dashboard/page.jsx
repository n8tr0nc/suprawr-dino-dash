"use client";

import React, { useEffect, useState, useRef } from "react";
import OverlayRoot from "./shell/overlays/OverlayRoot";
import TokenGate from "../../features/token-gate/TokenGate";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import GasTracker from "../../features/gas-tracker/GasTracker";

import "./styles/dashboard-shell.css";
import "./styles/modals.css";

const TERMINAL_FLICKER_DURATION = 350; // ms
const TERMINAL_FADE_DURATION = 500; // ms

/* Simple compact format for sidebar display */
function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1_000_000).toFixed(2)}M`;
}

/* Same rank logic as GasFeeStats */
function computeHolderRankFromDisplay(balanceDisplay) {
  if (!balanceDisplay) return null;

  const cleanedInt = String(balanceDisplay)
    .split(".")[0]
    .replace(/,/g, "")
    .trim();

  let whole;
  try {
    whole = BigInt(cleanedInt || "0");
  } catch {
    return null;
  }

  if (whole <= 0n) return null;

  if (whole >= 10_000_000n) return "Primal Master";
  if (whole >= 1_000_000n) return "Primal Titan";
  if (whole >= 100_000n) return "Primal Guardian";
  if (whole >= 1_000n) return "Scaleborn";
  return "Hatchling";
}

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [holderRank, setHolderRank] = useState(null);
  const [supraWrBalanceDisplay, setSupraWrBalanceDisplay] = useState(null);
  const [supraBalanceDisplay, setSupraBalanceDisplay] = useState(null);

  const [burnTotal, setBurnTotal] = useState(null);
  const [burnLoading, setBurnLoading] = useState(false);

  const [showRankModal, setShowRankModal] = useState(false);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  const [currentAddress, setCurrentAddress] = useState(null);
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  const refreshRunIdRef = useRef(0);

  // Ripple removed — only the connect effect remains
  const [showRiftFx, setShowRiftFx] = useState(false);
  const riftFxTimeoutRef = useRef(null);

  // ENTRY OVERLAY
  const [showEntryOverlay, setShowEntryOverlay] = useState(true);

  // NEW: terminal flicker-out before overlay fade
  const [terminalFlickerOut, setTerminalFlickerOut] = useState(false);

  // Overlay fade
  const [isFadingToTerminal, setIsFadingToTerminal] = useState(false);
  const fadeTimeoutRef = useRef(null);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleEnterGuest = () => {
    setShowEntryOverlay(false);
  };

  const handleCloseEntryOverlay = () => {
    setShowEntryOverlay(false);
  };

  /* Tier update listener */
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleTierUpdate(event) {
      const { holderRank, balanceDisplay, supraBalance } = event.detail || {};
      setHolderRank(holderRank || null);
      setSupraWrBalanceDisplay(balanceDisplay || null);
      setSupraBalanceDisplay(supraBalance || null);
    }

    window.addEventListener("suprawr:tierUpdate", handleTierUpdate);
    return () =>
      window.removeEventListener("suprawr:tierUpdate", handleTierUpdate);
  }, []);

  /* Wallet connect / disconnect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { address, connected } = event.detail || {};

      //--------------------------------------//
      //            WALLET CONNECT            //
      //--------------------------------------//
      if (connected && address) {
        setCurrentAddress(address);

        // stop any prior timers
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = null;
        }
        setIsFadingToTerminal(false);

        // Rift FX
        setShowRiftFx(true);
        if (riftFxTimeoutRef.current) {
          clearTimeout(riftFxTimeoutRef.current);
        }
        riftFxTimeoutRef.current = setTimeout(() => {
          setShowRiftFx(false);
          riftFxTimeoutRef.current = null;
        }, 1800);

        // Fetch burned SUPRAWR
        (async () => {
          setBurnLoading(true);
          try {
            const res = await fetch(
              `/api/burn-total?address=${encodeURIComponent(address)}`
            );
            if (res.ok) {
              const data = await res.json();
              setBurnTotal(
                data?.burn_suprawr && typeof data.burn_suprawr === "string"
                  ? data.burn_suprawr
                  : "0"
              );
            } else setBurnTotal("0");
          } catch {
            setBurnTotal("0");
          } finally {
            setBurnLoading(false);
          }
        })();

        // Fetch Supra price
        (async () => {
          try {
            const res = await fetch(`/api/supra-price?t=${Date.now()}`);
            const data = await res.json();
            if (data && typeof data.priceUsd === "number")
              setSupraUsdPrice(data.priceUsd);
          } catch {}
        })();

        return;
      }

      //--------------------------------------//
      //           WALLET DISCONNECT          //
      //--------------------------------------//

      refreshRunIdRef.current++;
      setCurrentAddress(null);
      setSupraBalanceDisplay(null);
      setSupraWrBalanceDisplay(null);
      setSupraUsdPrice(null);
      setBurnTotal(null);
      setBurnLoading(false);

      if (riftFxTimeoutRef.current) clearTimeout(riftFxTimeoutRef.current);
      setShowRiftFx(false);

      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);

      // 1. Flicker terminal UI
      setTerminalFlickerOut(true);

      // 2. After flicker, fade overlay
      setTimeout(() => {
        setTerminalFlickerOut(false);
        setIsFadingToTerminal(true);

        fadeTimeoutRef.current = setTimeout(() => {
          setShowEntryOverlay(true);
          setIsFadingToTerminal(false);
          fadeTimeoutRef.current = null;
        }, TERMINAL_FADE_DURATION);
      }, TERMINAL_FLICKER_DURATION);
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
      if (riftFxTimeoutRef.current) clearTimeout(riftFxTimeoutRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  /* Fetch price on load */
  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/supra-price?t=${Date.now()}`);
        const data = await res.json();
        if (!cancelled && data && typeof data.priceUsd === "number") {
          setSupraUsdPrice(data.priceUsd);
        }
      } catch {}
    }

    fetchPrice();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Manual refresh balances */
  const handleRefreshBalances = async () => {
    if (!currentAddress) return;

    const runId = ++refreshRunIdRef.current;

    try {
      setRefreshingBalances(true);
      setBurnLoading(true);

      const [balRes, priceRes, suprawrRes, burnRes] = await Promise.all([
        fetch(
          `/api/supra-balance?address=${encodeURIComponent(currentAddress)}`
        ),
        fetch(`/api/supra-price?t=${Date.now()}`),
        fetch(
          `/api/suprawr-balance?address=${encodeURIComponent(currentAddress)}`
        ),
        fetch(`/api/burn-total?address=${encodeURIComponent(currentAddress)}`),
      ]);

      if (refreshRunIdRef.current !== runId) return;

      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData?.balanceDisplay)
          setSupraBalanceDisplay(balData.balanceDisplay);
      }

      if (priceRes.ok) {
        const priceData = await priceRes.json();
        if (priceData?.priceUsd) setSupraUsdPrice(priceData.priceUsd);
      }

      if (suprawrRes.ok) {
        const wrData = await suprawrRes.json();
        if (wrData?.balanceDisplay) {
          setSupraWrBalanceDisplay(wrData.balanceDisplay);
          setHolderRank(
            computeHolderRankFromDisplay(wrData.balanceDisplay) || null
          );
        }
      }

      if (burnRes.ok) {
        const burnData = await burnRes.json();
        setBurnTotal(
          burnData?.burn_suprawr && typeof burnData.burn_suprawr === "string"
            ? burnData.burn_suprawr
            : "0"
        );
      } else setBurnTotal("0");
    } catch {
      setBurnTotal("0");
    } finally {
      setRefreshingBalances(false);
      setBurnLoading(false);
    }
  };

  const supraNativeUsdDisplay =
    supraBalanceDisplay && supraUsdPrice != null
      ? (parseFloat(supraBalanceDisplay) * supraUsdPrice).toFixed(2)
      : null;

  const supraLoading =
    !!currentAddress &&
    (refreshingBalances ||
      supraBalanceDisplay === null ||
      supraUsdPrice === null);

  const supraWrLoading =
    !!currentAddress &&
    (refreshingBalances || supraWrBalanceDisplay === null);

  const burnLineLoading =
    !!currentAddress &&
    (refreshingBalances || burnLoading || burnTotal === null);

  return (
    <TokenGate address={currentAddress}>
      <div
        className={`dashboard-shell ${
          isSidebarOpen ? "sidebar-open" : ""
        } ${isFadingToTerminal ? "dashboard-shell--fading-out" : ""}`}
      >
        {/* SIDEBAR */}
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          holderRank={holderRank}
          onOpenRankModal={() => setShowRankModal(true)}
          refreshingBalances={refreshingBalances}
          currentAddress={currentAddress}
          supraLoading={supraLoading}
          supraBalanceDisplay={supraBalanceDisplay}
          supraNativeUsdDisplay={supraNativeUsdDisplay}
          supraWrLoading={supraWrLoading}
          supraWrBalanceDisplay={supraWrBalanceDisplay}
          burnLineLoading={burnLineLoading}
          burnTotalDisplay={burnTotal}
          onRefreshBalances={handleRefreshBalances}
        />

        {isSidebarOpen && (
          <div className="sidebar-overlay" onClick={closeSidebar} />
        )}

        {/* HEADER AREA */}
        <main className="dashboard-main">
          <TopBar onToggleSidebar={toggleSidebar} />
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

          {/* MAIN CONTENT GRID */}
          <section className="dashboard-grid">
            <div className="dashboard-main-column">
              <GasTracker />
            </div>

            <div className="dashboard-side-column">
              <section className="dashboard-panel">
                <a
                  href="https://suprawr.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="./poster-airdrop-004.webp"
                    alt="Graduation Airdrop Poster"
                    className="poster-001"
                  />
                </a>
              </section>
            </div>
          </section>
        </main>

        {/* MOBILE NAV */}
        <nav className="mobile-bottom-nav">
          <button className="mobile-bottom-nav-item mobile-bottom-nav-item-active">
            <span className="mobile-bottom-nav-item-icon">⛽︎</span>
            <span className="mobile-bottom-nav-item-label">Gas Tracker</span>
          </button>
          <button className="mobile-bottom-nav-item">
            <span className="mobile-bottom-nav-item-icon">②</span>
            <span className="mobile-bottom-nav-item-label">Feature 02</span>
          </button>
          <button className="mobile-bottom-nav-item">
            <span className="mobile-bottom-nav-item-icon">③</span>
            <span className="mobile-bottom-nav-item-label">Feature 03</span>
          </button>
          <button className="mobile-bottom-nav-item">
            <span className="mobile-bottom-nav-item-icon">④</span>
            <span className="mobile-bottom-nav-item-label">Feature 04</span>
          </button>
        </nav>

        {/* RANK MODAL */}
        {showRankModal && holderRank && supraWrBalanceDisplay && (
          <div
            className="modal-001-overlay tier-modal-overlay"
            onClick={() => setShowRankModal(false)}
          >
            <div
              className="modal-001 tier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-001-header tier-modal-header">
                <h3 className="modal-001-title tier-modal-title">
                  $SUPRAWR Holder Ranks
                </h3>
                <button
                  className="modal-001-close tier-modal-close"
                  onClick={() => setShowRankModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-001-body tier-modal-body">
                <div className="tier-current">
                  Your rank{" "}
                  <span className="tier-current-name">{holderRank}</span>{" "}
                  <span className="tier-current-balance">
                    (
                    {formatCompactBalance(
                      parseFloat(supraWrBalanceDisplay || "0")
                    )}{" "}
                    $SUPRAWR)
                  </span>
                </div>

                <ul className="tier-list">
                  <li
                    className={`tier-list-item ${
                      holderRank === "Hatchling" ? "current-tier" : ""
                    }`}
                  >
                    Hatchling <span className="tier-range">1 – 999</span>
                  </li>

                  <li
                    className={`tier-list-item ${
                      holderRank === "Scaleborn" ? "current-tier" : ""
                    }`}
                  >
                    Scaleborn <span className="tier-range">1k – 99k</span>
                  </li>

                  <li
                    className={`tier-list-item ${
                      holderRank === "Primal Guardian" ? "current-tier" : ""
                    }`}
                  >
                    Primal Guardian{" "}
                    <span className="tier-range">100k – 999k</span>
                  </li>

                  <li
                    className={`tier-list-item ${
                      holderRank === "Primal Titan" ? "current-tier" : ""
                    }`}
                  >
                    Primal Titan <span className="tier-range">1M – 9.9M</span>
                  </li>

                  <li
                    className={`tier-list-item ${
                      holderRank === "Primal Master" ? "current-tier" : ""
                    }`}
                  >
                    Primal Master <span className="tier-range">10M+</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <OverlayRoot
          showEntryOverlay={showEntryOverlay}
          terminalFlickerOut={terminalFlickerOut}
          handleEnterGuest={handleEnterGuest}
          handleCloseEntryOverlay={handleCloseEntryOverlay}
          showRiftFx={showRiftFx}
        />
      </div>
    </TokenGate>
  );
}
