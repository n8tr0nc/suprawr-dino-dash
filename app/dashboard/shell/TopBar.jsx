"use client";

import React from "react";
import { useAccess } from "../../../features/access/useAccess";

export default function TopBar({ onToggleSidebar }) {
  const {
    connected,
    address,
    connect,
    disconnect,
    loadingBalances,
    loadingAccess,
  } = useAccess();

  const handleClick = async () => {
    if (connected) {
      await disconnect();
      // overlay behavior is handled in page.jsx by watching `connected === false`
    } else {
      await connect();
      // connecting here does NOT auto-close the terminal overlay
      // (overlay only closes when its own "enter" action fires)
    }
  };

  const label = connected ? "Disconnect" : "Connect Wallet";

  const short = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  const disabled = loadingBalances || loadingAccess;

  return (
    <div className="top-right-bar">
      {onToggleSidebar && (
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={onToggleSidebar}
        >
          ☰
        </button>
      )}

      <div className="top-right-wallet-group">
        {connected && (
          <span className="top-right-wallet-address">{short}</span>
        )}

        <button
          className="top-right-wallet-button"
          onClick={handleClick}
          disabled={disabled}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
