"use client";

import { Oxanium } from "next/font/google";
import "./globals.css";
import React from "react";
import { AccessProvider } from "../features/access/AccessProvider";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-oxanium",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={oxanium.variable}>
      <body>
        <AccessProvider>{children}</AccessProvider>
      </body>
    </html>
  );
}
