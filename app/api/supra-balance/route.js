// app/api/supra-balance/route.js
import { NextResponse } from "next/server";

// Base RPC host (no /rpc/v2 suffix here)
const SUPRA_RPC_HOST = "https://rpc-mainnet.supra.com";

// Native $SUPRA uses 8 decimals
const SUPRA_DECIMALS = 8n;

// Exact Move type for native SUPRA CoinStore
const SUPRA_COINSTORE_TYPE =
  "0x1::coin::CoinStore<0x1::supra_coin::SupraCoin>";

function ok(payload) {
  // Always return HTTP 200
  return NextResponse.json(payload, { status: 200 });
}

function formatSupra(rawBigInt) {
  if (!rawBigInt || rawBigInt <= 0n) return "0.00000000";

  const denom = 10n ** SUPRA_DECIMALS;
  const whole = rawBigInt / denom;
  const frac = rawBigInt % denom;
  const fracStr = frac.toString().padStart(Number(SUPRA_DECIMALS), "0");

  return `${whole.toString()}.${fracStr}`;
}

function extractSupraBalanceFromResource(resource) {
  if (!resource || typeof resource !== "object") return 0n;

  const typeStr = String(resource.type || "");
  if (
    !typeStr.includes("0x1::coin::CoinStore") ||
    !typeStr.toLowerCase().includes("supra")
  ) {
    return 0n;
  }

  const data = resource.data || {};

  const raw =
    data?.coin?.value ??
    data?.coin?.amount ??
    data?.fields?.coin?.value ??
    data?.fields?.coin?.amount ??
    null;

  if (raw == null) return 0n;

  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    // Soft fallback: 0 balance, ok:false
    return ok({
      ok: false,
      balanceRaw: "0",
      balanceDisplay: "0.00000000",
      error: "Missing address",
    });
  }

  try {
    const encodedType = encodeURIComponent(SUPRA_COINSTORE_TYPE);
    const url = `${SUPRA_RPC_HOST}/rpc/v2/accounts/${address}/resources/${encodedType}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.error(
        "supra-balance RPC error:",
        resp.status,
        resp.statusText
      );
      return ok({
        ok: false,
        balanceRaw: "0",
        balanceDisplay: "0.00000000",
        error: "Failed to fetch SUPRA CoinStore",
      });
    }

    const resource = await resp.json();
    const rawBalance = extractSupraBalanceFromResource(resource);
    const balanceDisplay = formatSupra(rawBalance);

    return ok({
      ok: true,
      balanceRaw: rawBalance.toString(),
      balanceDisplay,
    });
  } catch (err) {
    console.error("supra-balance fatal error:", err);
    return ok({
      ok: false,
      balanceRaw: "0",
      balanceDisplay: "0.00000000",
      error: "Failed to fetch SUPRA balance",
    });
  }
}

// Non-GET verbs: safe 200s, never used by your frontend
export function POST() {
  return ok({
    ok: false,
    balanceRaw: "0",
    balanceDisplay: "0.00000000",
    error: "Method not allowed",
  });
}
export function PUT() {
  return ok({
    ok: false,
    balanceRaw: "0",
    balanceDisplay: "0.00000000",
    error: "Method not allowed",
  });
}
export function DELETE() {
  return ok({
    ok: false,
    balanceRaw: "0",
    balanceDisplay: "0.00000000",
    error: "Method not allowed",
  });
}
