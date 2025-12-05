"use client";

import React, { useEffect, useState, useRef } from "react";
import TopRightBar from "./components/TopRightBar";
import GasFeeStats from "./components/GasFeeStats";
import RiftConnectOverlay from "./components/RiftConnectOverlay";
import RiftEntryOverlay from "./components/RiftEntryOverlay";

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

  // Burn total + loading flag
  const [burnTotal, setBurnTotal] = useState(null); // null = not loaded yet
  const [burnLoading, setBurnLoading] = useState(false);

  const [showRankModal, setShowRankModal] = useState(false);
  const [supraUsdPrice, setSupraUsdPrice] = useState(null);

  // For refresh button
  const [currentAddress, setCurrentAddress] = useState(null);
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  // run id so disconnect cancels any sidebar refresh in progress
  const refreshRunIdRef = useRef(0);

  // Rift connect FX (center shockwave)
  const [showRiftFx, setShowRiftFx] = useState(false);
  const riftFxTimeoutRef = useRef(null);

  // Rift Entry Terminal overlay (soft gate)
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

  /* Listen for tier updates sent from TopRightBar */
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleTierUpdate(event) {
      const { holderRank, balanceDisplay, supraBalance } = event.detail || {};
      setHolderRank(holderRank || null);
      setSupraWrBalanceDisplay(balanceDisplay || null);
      setSupraBalanceDisplay(supraBalance || null);
    }

    window.addEventListener("suprawr:tierUpdate", handleTierUpdate);
    return () => {
      window.removeEventListener("suprawr:tierUpdate", handleTierUpdate);
    };
  }, []);

  /* Track current connected wallet address from global walletChange events */
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleWalletChange(event) {
      const { address, connected } = event.detail || {};

      if (connected && address) {
        setCurrentAddress(address);

        // 🔥 Trigger Rift connect FX on every successful connect
        setShowRiftFx(true);
        if (riftFxTimeoutRef.current) {
          clearTimeout(riftFxTimeoutRef.current);
        }
        riftFxTimeoutRef.current = setTimeout(() => {
          setShowRiftFx(false);
          riftFxTimeoutRef.current = null;
        }, 1800);

        // Fetch burned SUPRAWR total
        (async () => {
          setBurnLoading(true);
          try {
            const res = await fetch(
              `/api/burn-total?address=${encodeURIComponent(address)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data && typeof data.burn_suprawr === "string") {
                setBurnTotal(data.burn_suprawr);
              } else {
                setBurnTotal("0");
              }
            } else {
              setBurnTotal("0");
            }
          } catch (err) {
            console.error("Failed to fetch burn total:", err);
            setBurnTotal("0");
          } finally {
            setBurnLoading(false);
          }
        })();

        // On every connect, fetch a fresh, uncached SUPRA USD price
        (async () => {
          try {
            const res = await fetch(`/api/supra-price?t=${Date.now()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data && typeof data.priceUsd === "number") {
              setSupraUsdPrice(data.priceUsd);
            }
          } catch (err) {
            console.error(
              "Failed to fetch SUPRA price on wallet connect:",
              err
            );
          }
        })();
      } else {
        // invalidate any ongoing refresh when disconnect fires
        refreshRunIdRef.current++;
        setCurrentAddress(null);
        setSupraBalanceDisplay(null);
        setSupraWrBalanceDisplay(null);
        setSupraUsdPrice(null);
        setBurnTotal(null);
        setBurnLoading(false);

        // stop any in-flight Rift FX if user disconnects
        if (riftFxTimeoutRef.current) {
          clearTimeout(riftFxTimeoutRef.current);
          riftFxTimeoutRef.current = null;
        }
        setShowRiftFx(false);

        // Return to terminal on disconnect
        setShowEntryOverlay(true);
      }
    }

    window.addEventListener("suprawr:walletChange", handleWalletChange);
    return () => {
      window.removeEventListener("suprawr:walletChange", handleWalletChange);
      // cleanup any leftover FX timer on unmount
      if (riftFxTimeoutRef.current) {
        clearTimeout(riftFxTimeoutRef.current);
      }
    };
  }, []);

  /* Fetch SUPRA USD price once initially (page load) */
  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/supra-price?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data.priceUsd === "number") {
          setSupraUsdPrice(data.priceUsd);
        }
      } catch (err) {
        console.error("Failed to fetch SUPRA price:", err);
      }
    }

    fetchPrice();
    return () => {
      cancelled = true;
    };
  }, []);

  // Manual refresh for SUPRA balance + price + SUPRAWR balance + burn total
  const handleRefreshBalances = async () => {
    if (!currentAddress) {
      console.warn("No connected wallet address; cannot refresh balances.");
      return;
    }

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
        fetch(
          `/api/burn-total?address=${encodeURIComponent(currentAddress)}`
        ),
      ]);

      // if disconnect happened while these were in flight, drop results
      if (refreshRunIdRef.current !== runId) {
        return;
      }

      // SUPRA native balance
      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData && typeof balData.balanceDisplay === "string") {
          setSupraBalanceDisplay(balData.balanceDisplay);
        }
      }

      // SUPRA USD price
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        if (priceData && typeof priceData.priceUsd === "number") {
          setSupraUsdPrice(priceData.priceUsd);
        }
      }

      // SUPRAWR balance (no USD, just total + rank)
      if (suprawrRes.ok) {
        const wrData = await suprawrRes.json();
        if (wrData && typeof wrData.balanceDisplay === "string") {
          setSupraWrBalanceDisplay(wrData.balanceDisplay);
          const newRank = computeHolderRankFromDisplay(wrData.balanceDisplay);
          setHolderRank(newRank);
        }
      }

      // Burn total
      if (burnRes.ok) {
        const burnData = await burnRes.json();
        if (burnData && typeof burnData.burn_suprawr === "string") {
          setBurnTotal(burnData.burn_suprawr);
        } else {
          setBurnTotal("0");
        }
      } else {
        setBurnTotal("0");
      }
    } catch (err) {
      console.error("Failed to refresh balances:", err);
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

  // Flags for skeletons
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
    <div
      className={`dashboard-shell ${
        isSidebarOpen ? "sidebar-open" : ""
      } ${showRiftFx ? "rift-ripple-active" : ""}`}
    >
      {/* LEFT SIDEBAR */}
      <aside
        className={`dashboard-sidebar ${
          isSidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-top">
          {/* BRANDING */}
          <div className="sidebar-brand">
            <img
              src="/suprawr001.webp"
              alt="SUPRAWR"
              className="sidebar-brand-logo"
            />
            <div className="sidebar-brand-title">SUPRAWR</div>
            <div className="sidebar-brand-tagline">
              Tools for the Supra blockchain
            </div>
          </div>

          {/* RANK TAG RIGHT UNDER TAGLINE */}
          {holderRank && (
            <button
              type="button"
              className="sidebar-rank"
              onClick={() => setShowRankModal(true)}
            >
              <span className="sidebar-holder-rank">[{holderRank}]</span>
            </button>
          )}

          {/* COINS, BALANCES */}
          <div className="sidebar-section">
            {/* HEADER, REFRESH */}
            <div className="sidebar-section-header balances-inside">
              <div className="sidebar-section-label">Balances</div>
              <button
                type="button"
                className="sidebar-refresh-button"
                onClick={handleRefreshBalances}
                disabled={refreshingBalances || !currentAddress}
                aria-label="Refresh balances"
              >
                {refreshingBalances ? "…" : "↻"}
              </button>
            </div>

            {/* $SUPRA */}
            {currentAddress && (
              <div className="sidebar-balance-line">
                <span className="sidebar-balance-line-label">$SUPRA</span>
                <span className="sidebar-balance-line-right">
                  {supraLoading ? (
                    <span className="balance-skeleton" />
                  ) : (
                    <>
                      {formatCompactBalance(
                        parseFloat(supraBalanceDisplay || "0")
                      )}
                      {supraNativeUsdDisplay &&
                        ` (~$${supraNativeUsdDisplay})`}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* $SUPRAWR */}
            {currentAddress && (
              <div className="sidebar-balance-line">
                <span className="sidebar-balance-line-label">$SUPRAWR</span>
                <span className="sidebar-balance-line-right">
                  {supraWrLoading ? (
                    <span className="balance-skeleton" />
                  ) : (
                    formatCompactBalance(
                      parseFloat(supraWrBalanceDisplay || "0")
                    )
                  )}
                </span>
              </div>
            )}

            {/* Burn total */}
            {currentAddress && (
              <div className="sidebar-balance-line">
                <span className="sidebar-balance-line-label">Burned</span>
                <span className="sidebar-balance-line-right">
                  {burnLineLoading ? (
                    <span className="balance-skeleton" />
                  ) : (
                    formatCompactBalance(parseFloat(burnTotal || "0"))
                  )}
                </span>
              </div>
            )}

            <a
              href="https://app.atmos.ag/en/token-studio/0x82ed1f483b5fc4ad105cef5330e480136d58156c30dc70cd2b9c342981997cee"
              target="_blank"
              rel="noopener noreferrer"
              className="get-suprawr-link sidebar-get-link"
            >
              Get $SUPRAWR 🡵
            </a>
          </div>

          {/* MODULES LIST */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">Modules</div>
            <ul className="sidebar-modules-list">
              <li className="sidebar-module sidebar-module-active">
                <span className="sidebar-module-label">Gas Tracker</span>
                <span className="sidebar-module-badge">Testing</span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Feature 02</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Dev
                </span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Feature 03</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Dev
                </span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Feature 04</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Dev
                </span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Leaderboard</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Dev
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="sidebar-social">
          <a
            href="https://x.com/SuprawrToken"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 24 24"
              height="24"
              width="24"
            >
              <path d="M10.4883 14.651L15.25 21H22.25L14.3917 10.5223L20.9308 3H18.2808L13.1643 8.88578L8.75 3H1.75L9.26086 13.0145L2.31915 21H4.96917L10.4883 14.651ZM16.25 19L5.75 5H7.75L18.25 19H16.25Z"></path>
            </svg>
          </a>

          <a
            href="https://t.me/SUPRAWRportal"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 256 256"
              height="24"
              width="24"
            >
              <path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z"></path>
            </svg>
          </a>

          <a
            href="https://suprawr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              width="24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm7.93 9H17c-.22-2.06-1-3.92-2.15-5.39A8.03 8.03 0 0 1 19.93 11zM12 4c1.62 0 3.2.56 4.47 1.6C15.09 7.26 14.22 9.5 14 12h-4c-.22 2.5-1.09 4.74-2.47 6.4A7.96 7.96 0 0 1 12 4zM4.07 13H7c.22 2.06 1 3.92 2.15 5.39A8.03 8.03 0 0 1 4.07 13zM12 20a7.96 7.96 0 0 1-4.47-1.6C8.91 16.74 9.78 14.5 10 12h4c.22 2.5 1.09 4.74 2.47 6.4A7.96 7.96 0 0 1 12 20zm4.85-1.61C17 16.92 17.78 15.06 18 13h2.93a8.03 8.03 0 0 1-4.08 5.39z" />
            </svg>
          </a>
        </div>

        <div className="sidebar-version">
          v0.1.0 – Built by the Suprawr Crew.
          <br />
          Nothing here is financial advice — just tools for dinos who like data.
        </div>
      </aside>

      {/* MOBILE SIDEBAR OVERLAY (click to close) */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* MAIN DASHBOARD AREA */}
      <main className="dashboard-main">
        <TopRightBar onToggleSidebar={toggleSidebar} />

        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <div>
              <h1 className="dashboard-title">
                <span className="gas-icon" role="img" aria-label="Gas icon">
                  ⛽︎
                </span>{" "}
                GAS TRACKER
              </h1>
              <p className="dashboard-subtitle">
                Track how much gas your Supra wallet has spent.
              </p>
            </div>
          </div>
        </header>

        <section className="dashboard-grid">
          <div className="dashboard-main-column">
            <section className="dashboard-panel">
              <div className="dashboard-panel-body">
                <GasFeeStats />
              </div>
            </section>
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

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav" aria-label="Suprawr modules">
        <button
          type="button"
          className="mobile-bottom-nav-item mobile-bottom-nav-item-active"
        >
          <span className="mobile-bottom-nav-item-icon">⛽︎</span>
          <span className="mobile-bottom-nav-item-label">Gas Tracker</span>
        </button>

        <button type="button" className="mobile-bottom-nav-item">
          <span className="mobile-bottom-nav-item-icon">②</span>
          <span className="mobile-bottom-nav-item-label">Feature 02</span>
        </button>

        <button type="button" className="mobile-bottom-nav-item">
          <span className="mobile-bottom-nav-item-icon">③</span>
          <span className="mobile-bottom-nav-item-label">Feature 03</span>
        </button>

        <button type="button" className="mobile-bottom-nav-item">
          <span className="mobile-bottom-nav-item-icon">④</span>
          <span className="mobile-bottom-nav-item-label">Feature 04</span>
        </button>
      </nav>

      {/* RANK MODAL (uses data from tierUpdate / refresh) */}
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

      {/* 🖥 Rift Entry Terminal Overlay (soft gate) */}
      <RiftEntryOverlay
        visible={showEntryOverlay}
        onEnterGuest={handleEnterGuest}
        onClose={handleCloseEntryOverlay}
      />

      {/* 🔥 Rift connect FX overlay */}
      <RiftConnectOverlay visible={showRiftFx} />
    </div>
  );
}
