"use client";

import "./globals.css";
import React from "react";

import { AccessProvider } from "../features/access/AccessProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AccessProvider>{children}</AccessProvider>
      </body>
    </html>
  );
}
