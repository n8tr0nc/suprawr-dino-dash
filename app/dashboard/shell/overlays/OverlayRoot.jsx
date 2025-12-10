"use client";

import React from "react";
import RiftEntryOverlay from "./RiftEntryOverlay";
import "../../styles/rift.css";

export default function OverlayRoot({
  showEntryOverlay,
  handleEnterGuest,
  showRiftFx, // reserved if you want FX again later
  ensureBgAudio,
}) {
  return (
    <>
      <RiftEntryOverlay
        visible={showEntryOverlay}
        onEnterGuest={handleEnterGuest}
        ensureBgAudio={ensureBgAudio}
      />
    </>
  );
}
