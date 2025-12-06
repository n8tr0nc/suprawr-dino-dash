"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import OverlayRoot from "./shell/overlays/OverlayRoot";
import TokenGate from "../../features/token-gate/TokenGate";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import GasTracker from "../../features/gas-tracker/GasTracker";

import "./styles/dashboard-shell.css";
import "./styles/modals.css";

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

// BALANCE CONVERSION – same behavior as in GasFeeStats.jsx
function formatCompactBalance(raw) {
  const num = Number(raw);
  if (isNaN(num)) return raw;

  if (num < 1000) return num.toString();

  let val, rounded, display;

  if (num < 1_000_000) {
    val = num / 1000;
    rounded = Math.round(val * 10) / 10;
    display = rounded % 1 === 0 ? `${rounded.toFixed(0)}K` : `${rounded}K`;
    return display;
  }

  val = num / 1_000_000;
  const full = val.toFixed(3);
  const rounded2 = (Math.round(val * 100) / 100).toFixed(2);
  const needsApprox = full.slice(0, 4) !== rounded2.slice(0, 4);

  return `${needsApprox ? "~" : ""}${rounded2}M`;
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

  // Rift FX
  const [showRiftFx, setShowRiftFx] = useState(false);
  const riftFxTimeoutRef = useRef(null);

  // ENTRY OVERLAY
  const [showEntryOverlay, setShowEntryOverlay] = useState(true);

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

  /* Wallet connect / disconnect (data + FX + overlay control) */
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { address, connected } = (event && event.detail) || {};

      // Ignore malformed or incomplete wallet events
      if (typeof connected !== "boolean") {
        return;
      }

      // Kill rank modal on any wallet change to stop red flash
      setShowRankModal(false);

      //--------------------------------------//
      //            WALLET CONNECT            //
      //--------------------------------------//
      if (connected && address) {
        setCurrentAddress(address);

        // HIDE terminal overlay – this is what triggers the fade-out in RiftEntryOverlay
        setShowEntryOverlay(false);

        // Clear Rift FX timer if any
        if (riftFxTimeoutRef.current) {
          clearTimeout(riftFxTimeoutRef.current);
          riftFxTimeoutRef.current = null;
        }

        // Rift FX (red burst overlay)
        setShowRiftFx(true);
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
            } else {
              setBurnTotal("0");
            }
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
            if (data && typeof data.priceUsd === "number") {
              setSupraUsdPrice(data.priceUsd);
            }
          } catch {
            // swallow
          }
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

      if (riftFxTimeoutRef.current) {
        clearTimeout(riftFxTimeoutRef.current);
        riftFxTimeoutRef.current = null;
      }

      setShowRiftFx(false);

      // RE-OPEN terminal overlay on disconnect
      setShowEntryOverlay(true);
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
      if (riftFxTimeoutRef.current) {
        clearTimeout(riftFxTimeoutRef.current);
      }
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
        fetch(`/api/supra-balance?address=${encodeURIComponent(currentAddress)}`),
        fetch(`/api/supra-price?t=${Date.now()}`),
        fetch(`/api/suprawr-balance?address=${encodeURIComponent(currentAddress)}`),
        fetch(`/api/burn-total?address=${encodeURIComponent(currentAddress)}`),
      ]);

      if (refreshRunIdRef.current !== runId) return;

      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData?.balanceDisplay) {
          setSupraBalanceDisplay(balData.balanceDisplay);
        }
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
      } else {
        setBurnTotal("0");
      }
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

  const supraBalanceCompact = useMemo(
    () =>
      supraBalanceDisplay
        ? formatCompactBalance(parseFloat(supraBalanceDisplay))
        : null,
    [supraBalanceDisplay]
  );

  const supraWrBalanceCompact = useMemo(
    () =>
      supraWrBalanceDisplay
        ? formatCompactBalance(parseFloat(supraWrBalanceDisplay))
        : null,
    [supraWrBalanceDisplay]
  );

  const burnTotalCompact = useMemo(
    () =>
      burnTotal ? formatCompactBalance(parseFloat(burnTotal)) : null,
    [burnTotal]
  );

  return (
    <TokenGate address={currentAddress}>
      <div className={`dashboard-shell ${isSidebarOpen ? "sidebar-open" : ""}`}>
        {/* SIDEBAR */}
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          holderRank={holderRank}
          onOpenRankModal={() => setShowRankModal(true)}
          refreshingBalances={refreshingBalances}
          currentAddress={currentAddress}
          supraLoading={supraLoading}
          supraBalanceDisplay={supraBalanceCompact}
          supraNativeUsdDisplay={supraNativeUsdDisplay}
          supraWrLoading={supraWrLoading}
          supraWrBalanceDisplay={supraWrBalanceCompact}
          burnLineLoading={burnLineLoading}
          burnTotalDisplay={burnTotalCompact}
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
          handleEnterGuest={handleEnterGuest}
          showRiftFx={showRiftFx}
        />
      </div>
    </TokenGate>
  );
}
