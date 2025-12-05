// app/layout.jsx
import "./globals.css";

// Load Google Fonts using next/font for best performance.
// These match your existing Oxanium (titles) + Roboto (body) setup.

import { Oxanium, Roboto } from "next/font/google";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-oxanium",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata = {
  title: "Suprawr - Supra Blockchain Tools",
  description:
    "Track your Supra coin ($SUPRA) gas fees and lifetime activity with the Suprawr Gas Tracker.",
};

// NOTE: App Router uses <html> and <body> directly inside layout.
// This file replaces BOTH _app.js and _document.js.

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${oxanium.variable} ${roboto.variable}`}>
        {children}
      </body>
    </html>
  );
}
