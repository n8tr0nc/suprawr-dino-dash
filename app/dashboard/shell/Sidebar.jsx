"use client";

import React from "react";

export default function Sidebar({
  isSidebarOpen,
  holderRank,
  onOpenRankModal,
  refreshingBalances,
  currentAddress,
  supraLoading,
  supraBalanceDisplay,
  supraNativeUsdDisplay,
  supraWrLoading,
  supraWrBalanceDisplay,
  burnLineLoading,
  burnTotalDisplay,
  onRefreshBalances,
}) {
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
            Tools for the Supra blockchain
          </div>
        </div>

        {holderRank && (
          <button
            type="button"
            className="sidebar-rank"
            onClick={onOpenRankModal}
          >
            <span className="sidebar-holder-rank">[{holderRank}]</span>
          </button>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-header balances-inside">
            <div className="sidebar-section-label">Balances</div>
            <button
              type="button"
              className="sidebar-refresh-button"
              onClick={onRefreshBalances}
              disabled={refreshingBalances || !currentAddress}
              aria-label="Refresh balances"
            >
              {refreshingBalances ? "…" : "↻"}
            </button>
          </div>

          {currentAddress && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">$SUPRA</span>
              <span className="sidebar-balance-line-right">
                {supraLoading ? (
                  <span className="balance-skeleton" />
                ) : (
                  <>
                    {supraBalanceDisplay}
                    {supraNativeUsdDisplay &&
                      ` (~$${supraNativeUsdDisplay})`}
                  </>
                )}
              </span>
            </div>
          )}

          {currentAddress && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">$SUPRAWR</span>
              <span className="sidebar-balance-line-right">
                {supraWrLoading ? (
                  <span className="balance-skeleton" />
                ) : (
                  supraWrBalanceDisplay
                )}
              </span>
            </div>
          )}

          {currentAddress && (
            <div className="sidebar-balance-line">
              <span className="sidebar-balance-line-label">Burned</span>
              <span className="sidebar-balance-line-right">
                {burnLineLoading ? (
                  <span className="balance-skeleton" />
                ) : (
                  burnTotalDisplay
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
          className="social-icon"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ⓧ
        </a>
        <a
          href="https://t.me/SUPRAWRportal"
          className="social-icon"
          target="_blank"
          rel="noopener noreferrer"
        >
          ✆
        </a>
        <a
          href="https://suprawr.com"
          className="social-icon"
          target="_blank"
          rel="noopener noreferrer"
        >
          ◎
        </a>
      </div>

      <div className="sidebar-version">
        v0.1.0 — Built by the Suprawr Crew. Nothing here is financial advice, just stats for dinos who love data.
      </div>
    </aside>
  );
}
