// pages/index.js
import Head from 'next/head';
import GasFeeStats from '../components/GasFeeStats';

export default function Home() {
  return (
    <div className="page-container">
      <Head>
        <title>Suprawr Gas Tracker</title>

        {/* Google Fonts: Oxanium (titles) + Roboto (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium:wght@600;700;800&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <main className="page-main">
        {/* Top-left SUPRAWR logo */}
        <div className="corner-dino-logo">
          <img src="/suprawr001.webp" alt="SUPRAWR" />
          <span className="corner-dino-text">Suprawr</span>
        </div>

        <div className="card-wrapper">
          <GasFeeStats />
        </div>
        {/* Bottom-left social bar */}
        <div className="social-bar">
          {/* X link */}
          <a
            href="https://x.com/suprawrcoin"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="X (Twitter)"
          >
            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M10.4883 14.651L15.25 21H22.25L14.3917 10.5223L20.9308 3H18.2808L13.1643 8.88578L8.75 3H1.75L9.26086 13.0145L2.31915 21H4.96917L10.4883 14.651ZM16.25 19L5.75 5H7.75L18.25 19H16.25Z"></path></svg>
          </a>
          {/* Telegram link */}
          <a
            href="https://t.me/suprawrcoin"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="Telegram"
          >
            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 256 256" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z"></path></svg>
          </a>
        </div>
      </main>
    </div>
  );
}
