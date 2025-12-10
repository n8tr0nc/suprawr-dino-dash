"use client";

import { useContext } from "react";
import { StatsContext } from "./StatsProvider";

export function useStats() {
  const ctx = useContext(StatsContext);

  if (!ctx) {
    throw new Error("useStats must be used inside a StatsProvider");
  }

  return ctx;
}
