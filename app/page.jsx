// app/page.jsx
import TopRightBar from "./components/TopRightBar";
import GasFeeStats from "./components/GasFeeStats";

export default function Home() {
  return (
    <div className="dashboard-shell">
      {/* LEFT SIDEBAR */}
      <aside className="dashboard-sidebar">
        <div>
          <div className="sidebar-brand">
            <img
              src="/suprawr001.webp"
              alt="SUPRAWR"
              className="sidebar-brand-logo"
            />
            <div className="sidebar-brand-title">SUPRAWR</div>
            <div className="sidebar-brand-tagline">Tools for the Supra blockchain</div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Modules</div>
            <ul className="sidebar-modules-list">
              <li className="sidebar-module sidebar-module-active">
                <span className="sidebar-module-label">Gas Tracker</span>
                <span className="sidebar-module-badge">Live</span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Wallet Overview</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Soon
                </span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Burn Radar</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Soon
                </span>
              </li>
              <li className="sidebar-module">
                <span className="sidebar-module-label">Leaderboard</span>
                <span className="sidebar-module-badge sidebar-module-badge--soon">
                  Soon
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
        </div>
      </aside>

      {/* MAIN DASHBOARD AREA */}
      <main className="dashboard-main">
        <TopRightBar />
        {/* Top title bar */}
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">DINO DASH</h1>
            <p className="dashboard-subtitle">
              Track how much gas your Supra wallet has burned and get ready for
              more RAWR-powered analytics.
            </p>
          </div>
        </header>

        {/* Two-column layout: main gas panel + right placeholders */}
        <section className="dashboard-grid">
          {/* LEFT: GAS TRACKER PANEL */}
          <div className="dashboard-main-column">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <span className="dashboard-panel-title">GAS TRACKER</span>
                <span className="dashboard-panel-pill">
                  Powered by Supra RPC
                </span>
              </div>
              <div className="dashboard-panel-body">
                <GasFeeStats />
              </div>
            </section>
          </div>

          {/* RIGHT: FUTURE PANELS */}
          <div className="dashboard-side-column">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <span className="dashboard-panel-title">ACTIVITY HEATMAP</span>
                <span className="dashboard-panel-pill dashboard-pill-soon">
                  Coming soon
                </span>
              </div>
              <div className="dashboard-panel-body dashboard-panel-placeholder">
                <p>
                  Placeholder for a calendar-style heatmap showing wallet
                  spikes.
                </p>
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <span className="dashboard-panel-title">HOLDER INSIGHTS</span>
                <span className="dashboard-panel-pill dashboard-pill-soon">
                  Coming soon
                </span>
              </div>
              <div className="dashboard-panel-body dashboard-panel-placeholder">
                <p>
                  Planned metrics for RAWRpack holder tiers + comparisons.
                </p>
              </div>
            </section>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="dashboard-footer">
          <span className="dashboard-version">
            v0.1.0 – Built by the $SUPRAWR crew. Nothing here is financial
            advice—just tools for dinos who like data.
          </span>
        </footer>
      </main>

      {/* BOTTOM-LEFT SOCIAL ICONS */}
      <div className="social-bar">
        {/* X */}
        <a
          href="https://x.com/SuprawrToken"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
          aria-label="X (Twitter)"
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 24 24"
            height="24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M10.4883 14.651L15.25 21H22.25L14.3917 10.5223L20.9308 3H18.2808L13.1643 8.88578L8.75 3H1.75L9.26086 13.0145L2.31915 21H4.96917L10.4883 14.651ZM16.25 19L5.75 5H7.75L18.25 19H16.25Z"></path>
          </svg>
        </a>

        {/* Telegram */}
        <a
          href="https://t.me/SUPRAWRportal"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
          aria-label="Telegram"
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 256 256"
            height="24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z"></path>
          </svg>
        </a>

        {/* Website */}
        <a
          href="https://suprawr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
          aria-label="Website"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24"
            width="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm7.93 9H17c-.22-2.06-1-3.92-2.15-5.39A8.03 8.03 0 0 1 19.93 11zM12 4c1.62 0 3.2.56 4.47 1.6C15.09 7.26 14.22 9.5 14 12h-4c-.22-2.5-1.09-4.74-2.47-6.4A7.96 7.96 0 0 1 12 4zM4.07 13H7c.22 2.06 1 3.92 2.15 5.39A8.03 8.03 0 0 1 4.07 13zM12 20a7.96 7.96 0 0 1-4.47-1.6C8.91 16.74 9.78 14.5 10 12h4c.22 2.5 1.09 4.74 2.47 6.4A7.96 7.96 0 0 1 12 20zm4.85-1.61C17 16.92 17.78 15.06 18 13h2.93a8.03 8.03 0 0 1-4.08 5.39z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
