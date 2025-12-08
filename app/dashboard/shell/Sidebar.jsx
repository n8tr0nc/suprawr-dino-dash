"use client";

import React from "react";
import { useAccess } from "../../../features/access/useAccess";

// Compact formatter just for display in the sidebar
function formatSidebarBalance(raw) {
  if (raw == null || raw === "") return raw;

  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;

  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const decimals = m >= 10 ? 1 : 2;
    return `${sign}~${m.toFixed(decimals)}M`;
  }

  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}~${k.toFixed(1)}K`;
  }

  return `${sign}~${abs.toFixed(2)}`;
}

// -------------------------------
// Resolve badge path
// -------------------------------
function getRankBadgePath(tier) {
  switch (tier) {
    case "Hatchling":
      return "/rank/hatchling-001.webp";
    case "Scaleborn":
      return "/rank/scaleborn-001.webp";
    case "Primal Guardian":
      return "/rank/gaurdian-001.webp"; // spelled this way in your folder
    case "Primal Titan":
      return "/rank/titan-001.webp";
    case "Primal Master":
      return "/rank/master-001.webp";
    default:
      return null;
  }
}

export default function Sidebar({
  isSidebarOpen,
  onOpenRankModal,
}) {
  const {
    connected,
    address,
    supraBalance,
    supraWrBalance,
    burnTotal,
    accessTier,
    supraUsdPrice,
    loadingBalances,
    refresh,
  } = useAccess();

  const shortAddress =
    address && address.length > 10
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : address || "";

  const supraNativeUsdDisplay =
    supraBalance && supraUsdPrice
      ? (parseFloat(supraBalance) * supraUsdPrice).toFixed(2)
      : null;

  const formattedSupra =
    !loadingBalances && supraBalance != null
      ? formatSidebarBalance(supraBalance)
      : null;

  const formattedSupraWr =
    !loadingBalances && supraWrBalance != null
      ? formatSidebarBalance(supraWrBalance)
      : null;

  const formattedBurn =
    !loadingBalances && burnTotal != null
      ? formatSidebarBalance(burnTotal)
      : null;

  const badgeSrc = accessTier ? getRankBadgePath(accessTier) : null;

  return (
    <aside
      className={`dashboard-sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img
            src="/suprawr001.webp"
            alt="SUPRAWR"
            className="sidebar-brand-logo"
          />
          <div className="sidebar-brand-title">SUPRAWR</div>
          <div className="sidebar-brand-tagline">
            Supra Wallet Telemetry
          </div>
        </div>

        {/* ------------------------------ */}
        {/*   RANK BADGE BUTTON            */}
        {/* ------------------------------ */}
        {accessTier && (
          <button
            type="button"
            className="sidebar-rank"
            onClick={onOpenRankModal}
          >
            {badgeSrc && (
              <img
                src={badgeSrc}
                alt={accessTier}
                className="sidebar-rank-badge"
              />
            )}

            <span className="sidebar-rank-label">{accessTier}</span>
          </button>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-header balances-inside">
            <div className="sidebar-section-label">Balances</div>

            <button
              type="button"
              className="sidebar-refresh-button"
              onClick={refresh}
              disabled={loadingBalances || !connected}
              aria-label="Refresh balances"
            >
              {loadingBalances ? "…" : "↻"}
            </button>
          </div>

          {connected && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">$SUPRA</span>
              <span className="sidebar-balance-line-right">
                {loadingBalances ? (
                  <span className="balance-skeleton" />
                ) : (
                  <>
                    {formattedSupra}
                    {supraNativeUsdDisplay &&
                      ` (~$${supraNativeUsdDisplay})`}
                  </>
                )}
              </span>
            </div>
          )}

          {connected && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">$SUPRAWR</span>
              <span className="sidebar-balance-line-right">
                {loadingBalances ? (
                  <span className="balance-skeleton" />
                ) : (
                  formattedSupraWr
                )}
              </span>
            </div>
          )}

          {connected && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">Burned</span>
              <span className="sidebar-balance-line-right">
                {loadingBalances ? (
                  <span className="balance-skeleton" />
                ) : (
                  formattedBurn
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

        <div className="sidebar-section">
          <div className="sidebar-section-label">Modules</div>
          <ul className="sidebar-modules-list">
            <li className="sidebar-module sidebar-module-active">
              <span className="sidebar-module-label">Gas Tracker</span>
              <span className="sidebar-module-badge">Private Testing</span>
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

      {/* SOCIALS — unchanged */}
      <div className="sidebar-social">
        <a
          href="https://x.com/suprawrcoin"
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
          href="https://t.me/suprawrcoin"
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
            <path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM104,210.93V158.75l26.73,23.46Zm68.53,7L92.85,135.5l119-85.29Z"></path>
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
        v0.2.2 — Built by the Suprawr Crew. Nothing here is financial advice,
        just stats for dinos who love data.
      </div>
    </aside>
  );
}
