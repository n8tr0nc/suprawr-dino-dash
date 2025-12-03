import { NextResponse } from "next/server";

const RPC_BASE_URL = "https://rpc-mainnet.supra.com";
const PAGE_SIZE = 100;

// Taken directly from the Supra RPC JSON you provided.
const BURN_FUNCTION =
  "0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234::atmos_pump::burn_token";

// SUPRAWR fungible asset store that is debited on burn (from your tx JSON).
const SUPRAWR_FA_STORE =
  "0x4ec22340343c83be25f35b68f0686761ba24d9575a281f181a32fe6173c8702e";

// On-chain SUPRAWR decimals (from your SupraScan example: 5000 → 5000000000000).
const SUPRAWR_DECIMALS = 6n;
const SUPRAWR_SCALE = 10n ** SUPRAWR_DECIMALS;

// Display with up to 6 decimals.
const DISPLAY_DECIMALS = 6n;
const DISPLAY_SCALE = 10n ** DISPLAY_DECIMALS;

// Fetch a single page of v3 account transactions
async function fetchTransactionsPage(address, start) {
  const params = new URLSearchParams();
  params.set("count", String(PAGE_SIZE));
  params.set("ascending", "true"); // v3: oldest → newest

  if (typeof start === "number" && start >= 0) {
    params.set("start", String(start));
  }

  const url = `${RPC_BASE_URL}/rpc/v3/accounts/${address}/transactions?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Supra v3 transactions request failed: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  // v3 docs: this endpoint returns a bare JSON array of Transaction.
  if (!Array.isArray(data)) {
    throw new Error(
      "Unexpected Supra v3 transactions response shape (expected array)"
    );
  }

  return data;
}

// Fetch ALL transactions for the account via pagination.
// v3 semantics: `start` is starting sequence number (inclusive).
async function fetchAllTransactions(address) {
  const all = [];
  let start = 0;

  while (true) {
    const page = await fetchTransactionsPage(address, start);
    if (!page.length) {
      break;
    }

    all.push(...page);

    if (page.length < PAGE_SIZE) {
      // Last page reached
      break;
    }

    // Next page starts after the last sequence “window”.
    start += PAGE_SIZE;
  }

  return all;
}

// Extract raw burn amount (BigInt) from a single transaction.
//
// This matches the Supra RPC / SupraScan JSON you provided:
// - payload.Move.function === BURN_FUNCTION
// - output.Move.events[] contains a
//   type "0x1::fungible_asset::Withdraw"
//   with data.store === SUPRAWR_FA_STORE
//   and data.amount = burned SUPRAWR in raw units.
function extractBurnAmountFromTransaction(tx) {
  if (!tx || !tx.payload || !tx.payload.Move) return 0n;

  const payload = tx.payload.Move;

  if (
    payload.type !== "entry_function_payload" ||
    typeof payload.function !== "string" ||
    payload.function !== BURN_FUNCTION
  ) {
    return 0n;
  }

  const events =
    tx.output &&
    tx.output.Move &&
    Array.isArray(tx.output.Move.events)
      ? tx.output.Move.events
      : [];

  for (const ev of events) {
    if (
      ev &&
      ev.type === "0x1::fungible_asset::Withdraw" &&
      ev.data &&
      ev.data.store === SUPRAWR_FA_STORE &&
      typeof ev.data.amount === "string"
    ) {
      try {
        return BigInt(ev.data.amount);
      } catch {
        return 0n;
      }
    }
  }

  return 0n;
}

// Format a raw SUPRAWR amount into a string with up to 6 decimals,
// based on 9 on-chain decimals.
function formatSupraWrAmount(raw) {
  const value = typeof raw === "bigint" ? raw : BigInt(raw || 0);

  if (value === 0n) {
    return "0";
  }

  const whole = value / SUPRAWR_SCALE;
  const frac = value % SUPRAWR_SCALE;

  if (frac === 0n) {
    return whole.toString();
  }

  // Scale fractional part down to DISPLAY_DECIMALS (6) places.
  const scaledFrac = (frac * DISPLAY_SCALE) / SUPRAWR_SCALE;

  let fracStr = scaledFrac.toString().padStart(Number(DISPLAY_DECIMALS), "0");

  // Trim trailing zeros from displayed fraction.
  fracStr = fracStr.replace(/0+$/, "");
  if (fracStr.length === 0) {
    return whole.toString();
  }

  return `${whole.toString()}.${fracStr}`;
}

// GET /api/burn-total?address=0x...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json(
      { error: "Missing 'address' query parameter" },
      { status: 400 }
    );
  }

  try {
    const allTxs = await fetchAllTransactions(address);

    let totalRaw = 0n;
    for (const tx of allTxs) {
      totalRaw += extractBurnAmountFromTransaction(tx);
    }

    const totalFormatted = formatSupraWrAmount(totalRaw);

    return NextResponse.json({
      address,
      burn_raw: totalRaw.toString(),      // raw on-chain integer
      burn_suprawr: totalFormatted,       // human-readable, up to 6 decimals
      total: totalFormatted,              // alias for compatibility
      decimals: Number(SUPRAWR_DECIMALS), // 9 on-chain
      display_decimals: Number(DISPLAY_DECIMALS), // 6 shown
    });
  } catch (err) {
    console.error("Error computing burn total:", err);
    return NextResponse.json(
      { error: "Failed to compute burn total" },
      { status: 500 }
    );
  }
}
