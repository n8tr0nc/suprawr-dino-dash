"use client";

import React from "react";
import RiftEntryOverlay from "./RiftEntryOverlay";
import RiftConnectOverlay from "./RiftConnectOverlay";

import "../../styles/rift.css";

export default function OverlayRoot({
  showEntryOverlay,
  handleEnterGuest,
  showRiftFx,
}) {
  return (
    <>
      {/* RIFT ENTRY TERMINAL */}
      <RiftEntryOverlay visible={showEntryOverlay} onEnterGuest={handleEnterGuest} />

      {/* RIFT CONNECT FX (red burst) */}
      <RiftConnectOverlay visible={showRiftFx} />
    </>
  );
}
