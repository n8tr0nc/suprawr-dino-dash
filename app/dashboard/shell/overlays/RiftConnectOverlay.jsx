// components/RiftConnectOverlay.jsx
import React from "react";

export default function RiftConnectOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className="rift-connect-overlay" aria-hidden="true">
      <div className="rift-connect-backdrop" />
      <div className="rift-connect-flash" />
      {/* Removed growing ring */}
      {/* <div className="rift-connect-ring" /> */}
      <div className="rift-connect-particles" />
    </div>
  );
}
