"use client";

import React from "react";
import GasFeeStats from "./GasFeeStats";

import "./GasTracker.css";

export default function GasTracker({ isSfxMuted }) {
  return (
    <section className="dashboard-panel panel-75">
      <div className="dashboard-panel-body">
        <GasFeeStats isSfxMuted={isSfxMuted} />
      </div>
    </section>
  );
}