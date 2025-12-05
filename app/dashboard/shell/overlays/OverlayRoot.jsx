"use client";

import React from "react";
import RiftEntryOverlay from "./RiftEntryOverlay";
import RiftConnectOverlay from "./RiftConnectOverlay";

import "../../styles/rift.css";

export default function OverlayRoot({
  showEntryOverlay,
  terminalFlickerOut,
  handleEnterGuest,
  handleCloseEntryOverlay,
  showRiftFx,
}) {
  return (
    <>
      {/* TERMINAL OVERLAY with new flickerOut */}
      <RiftEntryOverlay
        visible={showEntryOverlay}
        flickerOut={terminalFlickerOut}
        onEnterGuest={handleEnterGuest}
        onClose={handleCloseEntryOverlay}
      />

      {/* RIFT CONNECT FX */}
      <RiftConnectOverlay visible={showRiftFx} />
    </>
  );
}
