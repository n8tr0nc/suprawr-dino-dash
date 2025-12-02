"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// Format timestamps → “MM/DD/YY”
function formatDate(ts) {
  const d = new Date(ts);
  return (
    (d.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    d.getDate().toString().padStart(2, "0") +
    "/" +
    d.getFullYear().toString().slice(-2)
  );
}

// Tooltip formatter
function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const value = item.value;

  return (
    <div
      style={{
        background: "#001600",
        border: "1px solid #30d630",
        padding: "8px 10px",
        borderRadius: "2px",
        boxShadow: "0 0 10px #30d630",
        color: "#feeecd",
        fontFamily: "monospace",
        fontSize: "0.82rem",
      }}
    >
      <div style={{ marginBottom: "4px", color: "#7ae97a" }}>
        {formatDate(label)}
      </div>

      {mode === "tx" ? (
        <div>
          Gas Spent: <strong style={{ color: "#30d630" }}>{value} $SUPRA</strong>
        </div>
      ) : (
        <div>
          Cumulative Gas:{" "}
          <strong style={{ color: "#30d630" }}>{value} $SUPRA</strong>
        </div>
      )}
    </div>
  );
}

// Main component
export default function GasHistoryChart({
  history = [],
  cumulativeHistory = [],
}) {
  // Toggle slider (Per-TX = left, Cumulative = right)
  const [mode, setMode] = useState("tx"); // "tx" or "cum"

  // Prepare chart data based on mode
  const chartData = useMemo(() => {
    if (mode === "tx") {
      return history
        .map((pt) => ({
          ts: pt.ts,
          gas: Number(pt.gasSupra), // already formatted as string decimals; convert to number
        }))
        .sort((a, b) => a.ts - b.ts);
    } else {
      return cumulativeHistory
        .map((pt) => ({
          ts: pt.ts,
          gas: Number(pt.gasSupra),
        }))
        .sort((a, b) => a.ts - b.ts);
    }
  }, [mode, history, cumulativeHistory]);

  if (!history.length) {
    return (
      <div style={{ color: "#feeecd", fontSize: "0.9rem", opacity: 0.8 }}>
        No gas data yet. Run a calculation to generate your gas history chart.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "340px" }}>
      {/* HEADER + TOGGLE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#f9d580",
            fontFamily: "Oxanium",
            fontSize: "0.95rem",
            textTransform: "uppercase",
          }}
        >
          Gas History
        </h3>

        {/* Toggle switch */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            color: "#feeecd",
          }}
        >
          <span style={{ opacity: mode === "tx" ? 1 : 0.5 }}>Per-TX</span>

          <label
            style={{
              position: "relative",
              width: "50px",
              height: "22px",
              borderRadius: "22px",
              background: "#0e2713",
              cursor: "pointer",
              border: "1px solid #30d630",
            }}
          >
            <input
              type="checkbox"
              checked={mode === "cum"}
              onChange={() => setMode(mode === "tx" ? "cum" : "tx")}
              style={{ display: "none" }}
            />
            <span
              style={{
                position: "absolute",
                top: "1px",
                left: mode === "tx" ? "1px" : "27px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#30d630",
                transition: "all 0.18s ease-out",
              }}
            />
          </label>

          <span style={{ opacity: mode === "cum" ? 1 : 0.5 }}>Cumulative</span>
        </div>
      </div>

      {/* CHART */}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid stroke="#113516" strokeOpacity={0.35} />

          <XAxis
            dataKey="ts"
            tickFormatter={(ts) => formatDate(ts)}
            stroke="#feeecd"
            tick={{ fontSize: 11 }}
            minTickGap={20}
          />

          <YAxis
            stroke="#feeecd"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(4)}
          />

          <Tooltip content={<CustomTooltip mode={mode} />} />

          <Line
            type="monotone"
            dataKey="gas"
            stroke="#30d630"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#d5502c" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
