"use client";

import React, { useState, useEffect } from "react";

const getProvider = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if ("starkey" in window) {
    const provider = window.starkey?.supra;
    if (provider) {
      return provider;
    }
  }

  // If no provider, open Starkey site in a new tab
  window.open("https://starkey.app/", "_blank");
  return null;
};

const WalletConnection = () => {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    const connectWallet = async () => {
      const provider = getProvider();
      if (!provider) return;

      try {
        const accounts = await provider.connect();
        setAccount(accounts[0]);
        console.log(accounts[0]);
      } catch (err) {
        console.error("User rejected the request", err);
      }
    };

    // Add a ~4-second delay before attempting to connect to the wallet
    const timeoutId = setTimeout(() => {
      connectWallet();
    }, 4000);

    // Cleanup the timeout to avoid potential memory leaks
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div>
      {account ? (
        <p>Connected account: {account}</p>
      ) : (
        <p>Connecting to StarKey wallet...</p>
      )}
    </div>
  );
};

export default WalletConnection;
