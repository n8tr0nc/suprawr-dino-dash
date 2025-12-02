// app/api/supra-price/route.js
import { NextResponse } from "next/server";

function ok(payload) {
  // Always return HTTP 200 so the frontend never sees res.ok === false
  return NextResponse.json(payload, { status: 200 });
}

export async function GET() {
  try {
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=supra&vs_currencies=usd",
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store", // <-- force live price, no revalidation cache
      }
    );

    if (!cgRes.ok) {
      console.error(
        "Coingecko SUPRA price error:",
        cgRes.status,
        cgRes.statusText
      );
      return ok({
        ok: false,
        priceUsd: null,
        error: "Failed to fetch SUPRA price from CoinGecko",
      });
    }

    const data = await cgRes.json();
    const price = data?.supra?.usd;

    if (typeof price !== "number" || !Number.isFinite(price)) {
      console.error("Unexpected Coingecko SUPRA payload:", data);
      return ok({
        ok: false,
        priceUsd: null,
        error: "Invalid price data for SUPRA",
      });
    }

    return ok({
      ok: true,
      priceUsd: price,
    });
  } catch (err) {
    console.error("supra-price handler error:", err);
    return ok({
      ok: false,
      priceUsd: null,
      error: "Exception while fetching SUPRA price",
    });
  }
}

// Keep other methods soft-failing with 200 as well (defensive)
export function POST() {
  return ok({ ok: false, priceUsd: null, error: "Method not allowed" });
}
export function PUT() {
  return ok({ ok: false, priceUsd: null, error: "Method not allowed" });
}
export function DELETE() {
  return ok({ ok: false, priceUsd: null, error: "Method not allowed" });
}
