"use client";

import React from "react";
import GasFeeStats from "./GasFeeStats";

import "./GasTracker.css";

export default function GasTracker() {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-body">
        <GasFeeStats />
      </div>
    </section>
  );
}
