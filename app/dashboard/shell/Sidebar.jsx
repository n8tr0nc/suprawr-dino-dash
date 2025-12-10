"use client";

import React, { useEffect, useRef } from "react";
import { useWallet } from "../../../features/wallet/useWallet";
import { useStats } from "../../../features/stats/useStats";

// Compact formatter just for display in the sidebar
function formatSidebarBalance(raw) {
  if (raw == null || raw === "") return raw;

  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;

  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

// Basic formatter for USD price
function formatPriceUsd(value) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
}

// Holder rank badge image mapping
function getRankBadgeSrc(accessTier) {
  switch (accessTier) {
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

export default function Sidebar({ isSidebarOpen, onOpenRankModal }) {
  const { connected, address } = useWallet();
  const {
    supraBalance,
    supraWrBalance,
    burnTotal,
    accessTier,
    supraUsdPrice,
    loadingBalances,
    refresh,
  } = useStats();

  // -------------------------------
  // Refresh sound (loop while loadingBalances is true)
  // -------------------------------
  const refreshAudioRef = useRef(null);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!refreshAudioRef.current) {
      const audio = new Audio("/audio/bg-001.mp3"); // <-- this is your global bg, kept untouched
      audio.loop = true;
      audio.volume = 0.4;
      refreshAudioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    const prev = prevLoadingRef.current;
    if (!prev && loadingBalances) {
      // started loading
      const audio = refreshAudioRef.current;
      if (audio) {
        try {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch {}
      }
    } else if (prev && !loadingBalances) {
      // stopped loading
      const audio = refreshAudioRef.current;
      if (audio) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      }
    }
    prevLoadingRef.current = loadingBalances;
  }, [loadingBalances]);

  const shortAddr =
    connected && address
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : "Not connected";

  const rankBadgeSrc = getRankBadgeSrc(accessTier);

  return (
    <aside className={`sidebar ${isSidebarOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo-row">
          <div className="sidebar-logo-wrap">
            <img
              src="/suprawr001.webp"
              alt="Suprawr Dino"
              className="sidebar-logo"
            />
          </div>
          <div className="sidebar-title-wrap">
            <div className="sidebar-title-main">// SUPRAWR DINO DASH //</div>
            <div className="sidebar-title-sub">
              Supra gas telemetry for on-chain dino degenerates.
            </div>
          </div>
        </div>

        <div className="sidebar-wallet-pill">
          <div className="sidebar-wallet-label">Wallet</div>
          <div className="sidebar-wallet-value">{shortAddr}</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">RANK &amp; ACCESS</div>

        <div className="sidebar-rank-row">
          <div className="sidebar-rank-left">
            {rankBadgeSrc ? (
              <button
                type="button"
                className="sidebar-rank-badge-button"
                onClick={onOpenRankModal}
              >
                <img
                  src={rankBadgeSrc}
                  alt={accessTier || "Rank badge"}
                  className="sidebar-rank-badge-img"
                />
                <span className="sidebar-rank-badge-label">
                  {accessTier || "Unranked"}
                </span>
              </button>
            ) : (
              <div className="sidebar-rank-placeholder">
                <span className="sidebar-rank-placeholder-label">
                  No rank yet
                </span>
              </div>
            )}
          </div>

          <div className="sidebar-rank-right">
            <div className="sidebar-rank-line">
              <span className="sidebar-rank-key">Tier</span>
              <span className="sidebar-rank-value">
                {accessTier || "Hatchling"}
              </span>
            </div>
            <div className="sidebar-rank-line">
              <span className="sidebar-rank-key">$SUPRAWR</span>
              <span className="sidebar-rank-value">
                {supraWrBalance ?? "—"}
              </span>
            </div>
            <div className="sidebar-rank-line">
              <span className="sidebar-rank-key">Burned</span>
              <span className="sidebar-rank-value">{burnTotal ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">SUPRA OVERVIEW</div>

        <div className="sidebar-stat-row">
          <div className="sidebar-stat-label">$SUPRA Balance</div>
          <div className="sidebar-stat-value">
            {supraBalance != null ? formatSidebarBalance(supraBalance) : "—"}
          </div>
        </div>

        <div className="sidebar-stat-row">
          <div className="sidebar-stat-label">$SUPRA Price</div>
          <div className="sidebar-stat-value">
            {formatPriceUsd(supraUsdPrice)}
          </div>
        </div>

        <div className="sidebar-stat-actions">
          <button
            type="button"
            className="sidebar-refresh-button"
            onClick={refresh}
            disabled={!connected || loadingBalances}
          >
            {loadingBalances ? (
              <>
                <span className="sidebar-refresh-spinner" />
                <span>Updating stats…</span>
              </>
            ) : (
              <>
                <span className="sidebar-refresh-icon">⟳</span>
                <span>Refresh stats</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="sidebar-section sidebar-section--links">
        <div className="sidebar-section-title">SUPRAWR LINKS</div>

        <div className="sidebar-links-grid">
          <a
            href="https://suprawr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link-pill"
          >
            <span>// SUPRAWR HOME //</span>
          </a>

          <a
            href="https://t.me/suprawr"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link-pill"
          >
            <span>// RAWRPACK HQ //</span>
          </a>

          <a
            href="https://x.com/suprawrdino"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link-pill"
          >
            <span>// X: @SUPRAWRDINO //</span>
          </a>

          <a
            href="https://supra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link-pill"
          >
            <span>// SUPRA LABS //</span>
          </a>
        </div>
      </div>

      <div className="sidebar-section sidebar-section--social">
        <div className="sidebar-section-title">SOCIAL SCANNERS</div>

        <div className="sidebar-social-row">
          <a
            href="https://x.com/suprawrdino"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              width="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.23 3h3.27l-7.15 8.18L21 21h-5.5l-4.01-5.23L6.7 21H3.43l7.64-8.76L3 3h5.62l3.62 4.77z" />
            </svg>
          </a>

          <a
            href="https://t.me/suprawr"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              width="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9.04 18.71 9.14 15l7.28-6.56c.32-.29-.07-.43-.49-.19L7.8 13.2 4.2 12.12C3.42 11.88 3.41 11.35 4.36 10.98l14.3-5.52c.65-.24 1.29.16 1.04 1.26l-2.43 11.44c-.17.8-.64 1-1.29.62l-3.59-2.65-1.73 1.68c-.2.2-.37.37-.75.4Z" />
            </svg>
          </a>

          <a
            href="https://supra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              width="24"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M127,8A120.17,120.17,0,0,0,7,128,120.17,120.17,0,0,0,127,248,120.17,120.17,0,0,0,247,128,120.17,120.17,0,0,0,127,8Zm67.27,81.06L163,92.72,153.25,70.46l-60,20.28L81.54,62.23,160.92,37.45Zm28.58,38.89-31.88,55.2-56-36L148,117.14l61.85-21.07ZM160.3,33.35l-86,26.91L61.2,38.91ZM57.63,70.27,73.74,94.41l-37.84,12.9ZM36.82,190.63,26.06,171.3l30.4-52.57L92.68,121Zm16.11,27.3L98.51,135l45,28.9L127,225.75ZM104.5,228.59l18.23-59.59,24.46,15.69L135,232.45A108.73,108.73,0,0,1,104.5,228.59Zm49.54,3.14,8.7-29.92,9.13,6.33C167.55,215.6,163.43,223.32,154,231.73ZM188,205.31l-12.63-8.75,39.22-51.87,4.89,32.93A108.87,108.87,0,0,1,188,205.31Zm36.9-60.76-6.19-41.69a8,8,0,0,0-10.62-6.41L61.45,135.08,42,169.12l-6-10.74,19.68-35.28L27.1,132.35c-.54-1.93-1-3.89-1.39-5.86L61.88,113l-10-6.94a7.94,7.94,0,0,0-4.37-1.43,8.18,8.18,0,0,0-2.47.38l-9.1,3.11q-1.06-3-1.92-6.06L54.49,99,42.71,83.11c.44-1.05.91-2.08,1.39-3.11l9.79,14.08L68,90l-8.29-11.93c1.28-1.93,2.62-3.81,4-5.65l9.89,17.84,18-6.07L81.75,65.31l20.87-7.55,14.18,21.93L133,74.11l-9.56-14.8,20.14-6.3,10,21.53L176,66.12l-4.26-9.65a111.22,111.22,0,0,1,18.46,13.68l-6.88,2.31,7.82,8.66a110.76,110.76,0,0,1,11.94,16.79l-11.2,3.82,9.07,11.8a110.25,110.25,0,0,1,6,14.83Z"></path>
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm3.95 14.95c-1.3.84-2.8 1.29-4.37 1.29-2.29 0-4.4-.89-6-2.49C4.89 14.15 4 12.04 4 9.75 4 7.46 4.89 5.35 6.58 3.66 8.27 1.97 10.38 1.08 12.67 1.08c1.71 0 3.33.56 4.63 1.6l-1.35 1.5c-.96-.73-2.15-1.12-3.42-1.12-1.71 0-3.32.66-4.53 1.87C7.79 6.14 7.13 7.75 7.13 9.46c0 1.71.66 3.32 1.87 4.53 1.21 1.21 2.82 1.87 4.53 1.87 1.23 0 2.4-.36 3.38-1.03l1.36 1.49c-.94.71-2.03 1.16-3.35 1.63-1.32.47-2.72.72-4.17.72z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="sidebar-version">
        v0.2.2 — Built by the Suprawr Crew. Nothing here is financial advice,
        just stats for dinos who love data.
      </div>
    </aside>
  );
}
