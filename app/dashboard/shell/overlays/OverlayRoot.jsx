"use client";

import React from "react";
import RiftEntryOverlay from "./RiftEntryOverlay";
import "../../styles/rift.css";

export default function OverlayRoot({
  showEntryOverlay,
  handleEnterGuest,
}) {
  return (
    <>
      <RiftEntryOverlay
        visible={showEntryOverlay}
        onEnterGuest={handleEnterGuest}
      />
    </>
  );
}
