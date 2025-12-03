import { NextResponse } from "next/server";

const RPC_BASE_URL = "https://rpc-mainnet.supra.com";
const PAGE_SIZE = 100;

// VERIFIED burn function from multiple wallets
const BURN_FUNCTION =
  "0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234::atmos_pump::burn_token";

// VERIFIED SUPRAWR FA resource ID (first burn function argument)
const SUPRAWR_RESOURCE_ID =
  "0x82ed1f483b5fc4ad105cef5330e480136d58156c30dc70cd2b9c342981997cee";

// SUPRAWR uses 6 decimals
const SUPRAWR_DECIMALS = 6n;
const SUPRAWR_SCALE = 10n ** SUPRAWR_DECIMALS;

// Display with 2 decimals (required)
const DISPLAY_DECIMALS = 2n;
const DISPLAY_SCALE = 10n ** DISPLAY_DECIMALS;


// Fetch one page of transactions
async function fetchTransactionsPage(address, start) {
  const params = new URLSearchParams();
  params.set("count", PAGE_SIZE.toString());
  params.set("ascending", "true"); // oldest → newest

  if (start > 0) params.set("start", String(start));

  const url = `${RPC_BASE_URL}/rpc/v3/accounts/${address}/transactions?${params}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`RPC error ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected RPC response shape");
  }

  return data;
}


// Fetch ALL transactions via pagination
async function fetchAllTransactions(address) {
  const all = [];
  let start = 0;

  while (true) {
    const page = await fetchTransactionsPage(address, start);
    if (page.length === 0) break;

    all.push(...page);

    if (page.length < PAGE_SIZE) break;

    start += PAGE_SIZE;
  }

  return all;
}


// Extract burn amount from transaction
function extractBurnAmountFromTransaction(tx, walletAddress) {
  if (!tx?.payload?.Move) return 0n;
  const payload = tx.payload.Move;

  // Must be the burn function
  if (
    payload.type !== "entry_function_payload" ||
    payload.function !== BURN_FUNCTION
  ) {
    return 0n;
  }

  // Verify this is a SUPRAWR burn (Option C)
  const arg0 = payload.arguments?.[0];
  if (arg0 !== SUPRAWR_RESOURCE_ID) return 0n;

  // Verify sender belongs to this wallet
  const sender = tx.header?.sender?.Move;
  if (!sender || sender.toLowerCase() !== walletAddress.toLowerCase()) {
    return 0n;
  }

  // Find Withdraw events — store doesn't matter
  const events = tx.output?.Move?.events || [];
  let total = 0n;

  for (const ev of events) {
    if (ev.type === "0x1::fungible_asset::Withdraw") {
      try {
        const amt = BigInt(ev.data?.amount || "0");
        if (amt > 0n) total += amt;
      } catch {}
    }
  }

  return total;
}


// Format amount using 2 decimals
function formatSupraWrAmount(raw) {
  const v = BigInt(raw);

  if (v === 0n) return "0.00";

  const whole = v / SUPRAWR_SCALE;
  const frac = v % SUPRAWR_SCALE;

  const scaled = (frac * DISPLAY_SCALE) / SUPRAWR_SCALE;
  let fracStr = scaled.toString().padStart(Number(DISPLAY_DECIMALS), "0");

  return `${whole.toString()}.${fracStr}`;
}


// API route
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const allTxs = await fetchAllTransactions(address);

    let totalRaw = 0n;
    for (const tx of allTxs) {
      totalRaw += extractBurnAmountFromTransaction(tx, address);
    }

    const formatted = formatSupraWrAmount(totalRaw);

    return NextResponse.json({
      address,
      burn_raw: totalRaw.toString(),
      burn_suprawr: formatted,
      total: formatted,
      decimals: Number(SUPRAWR_DECIMALS),
      display_decimals: Number(DISPLAY_DECIMALS),
    });
  } catch (err) {
    console.error("burn-total error:", err);
    return NextResponse.json(
      { error: "Failed to compute burn total" },
      { status: 500 }
    );
  }
}
