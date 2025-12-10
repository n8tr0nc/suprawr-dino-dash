"use client";

import { Oxanium } from "next/font/google";
import "./globals.css";
import React from "react";
import { WalletProvider } from "./features/wallet/WalletProvider";
import { StatsProvider } from "./features/stats/StatsProvider";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-oxanium",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={oxanium.variable}>
      <body>
        <WalletProvider>
          <StatsProvider>{children}</StatsProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
