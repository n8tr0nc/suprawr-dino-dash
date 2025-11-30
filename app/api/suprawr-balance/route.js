// app/api/suprawr-balance/route.js
import { NextResponse } from "next/server";

// SUPRAWR Atmos Pump token address (same one you're already using)
const SUPRAWR_TOKEN_ADDRESS =
  "0x82ed1f483b5fc4ad105cef5330e480136d58156c30dc70cd2b9c342981997cee";

// Requirement: 1,000 SUPRAWR (display units)
const REQUIRED_SUPRAWR_WHOLE = 1_000n;

// Assumed decimals for Pump token display (can be adjusted if Atmos uses a different value)
const SUPRAWR_DECIMALS = 6n;

// AtmosSwap package address from Atmos docs (alias atmos_swap)
const ATMOS_SWAP_ADDRESS =
  "0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234";

// Fully-qualified view function for user balance
const GET_USER_BALANCE_FUNCTION = `${ATMOS_SWAP_ADDRESS}::atmos_pump::get_user_balance`;

// Supra mainnet RPC base
const SUPRA_RPC_VIEW_URL = "https://rpc-mainnet.supra.com/rpc/v2/view";

/**
 * Format a raw integer balance (u64) into a string with fixed decimals.
 * Example: raw=123456789, decimals=6 -> "123.456789"
 */
function formatRawBalance(rawBigInt, decimals = SUPRAWR_DECIMALS) {
  if (rawBigInt <= 0n) {
    return "0.000000";
  }

  const denom = 10n ** decimals;
  const whole = rawBigInt / denom;
  const frac = rawBigInt % denom;

  // We always show 6 decimal places to keep UI consistent
  const fracStr = frac.toString().padStart(Number(decimals), "0").slice(0, 6);

  return `${whole.toString()}.${fracStr}`;
}

/**
 * Extract a numeric value from Supra's MoveValueResponse for view (v2).
 * The response is typically:
 *   { "result": [ { "U64": "12345" } ] }
 */
function extractNumericFromViewResult(data) {
  if (!data || !Array.isArray(data.result) || data.result.length === 0) {
    return 0n;
  }

  const first = data.result[0];

  // If it's already a primitive
  if (typeof first === "string" || typeof first === "number") {
    try {
      return BigInt(first);
    } catch {
      return 0n;
    }
  }

  // If it's an object like { "U64": "12345" } or { "U128": "..." }
  if (first && typeof first === "object") {
    const key = Object.keys(first).find((k) =>
      /^U(8|16|32|64|128)$/i.test(k)
    );

    if (!key) return 0n;

    try {
      return BigInt(first[key]);
    } catch {
      return 0n;
    }
  }

  return 0n;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || typeof address !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing address" },
      { status: 400 }
    );
  }

  // Normalize user address (Move addresses are hex with 0x prefix)
  const userAddress = address.trim();

  try {
    // Call Atmos Pump view: get_user_balance(user_address, token_address)
    const body = {
      function: GET_USER_BALANCE_FUNCTION,
      type_arguments: [],
      arguments: [userAddress, SUPRAWR_TOKEN_ADDRESS],
    };

    const resp = await fetch(SUPRA_RPC_VIEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.error(
        "Supra view API non-OK:",
        resp.status,
        resp.statusText
      );
      return NextResponse.json(
        {
          ok: false,
          error: `Supra view API responded ${resp.status}`,
        },
        { status: 502 }
      );
    }

    const data = await resp.json();

    // Raw u64 balance in base units
    const rawBalance = extractNumericFromViewResult(data);

    // Convert to display string
    const balanceDisplay = formatRawBalance(rawBalance, SUPRAWR_DECIMALS);

    // Requirement in base units (1,000 * 10^decimals)
    const requiredRaw = REQUIRED_SUPRAWR_WHOLE * 10n ** SUPRAWR_DECIMALS;

    const meetsRequirement = rawBalance >= requiredRaw;

    return NextResponse.json(
      {
        ok: true,
        balanceDisplay,
        balanceRaw: rawBalance.toString(),
        meetsRequirement,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("suprawr-balance handler error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to execute Atmos Pump view for SUPRAWR balance",
      },
      { status: 500 }
    );
  }
}

// Optional 405s for other verbs (mirrors old handler semantics)
export function POST() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed" },
    { status: 405 }
  );
}

export function PUT() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed" },
    { status: 405 }
  );
}

export function DELETE() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed" },
    { status: 405 }
  );
}
