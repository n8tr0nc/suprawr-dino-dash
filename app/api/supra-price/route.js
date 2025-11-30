// app/api/supra-price/route.js
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // CoinGecko simple price endpoint for Supra (SUPRA)
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=supra&vs_currencies=usd",
      {
        headers: {
          Accept: "application/json",
        },
        // Optional: ensure this is not cached too aggressively by Next
        next: { revalidate: 30 },
      }
    );

    if (!cgRes.ok) {
      console.error(
        "Coingecko SUPRA price error:",
        cgRes.status,
        cgRes.statusText
      );
      return NextResponse.json(
        { ok: false, error: "Failed to fetch SUPRA price" },
        { status: 502 }
      );
    }

    const data = await cgRes.json();
    const price = data?.supra?.usd;

    if (typeof price !== "number" || !Number.isFinite(price)) {
      console.error("Unexpected Coingecko SUPRA payload:", data);
      return NextResponse.json(
        { ok: false, error: "Invalid price data for SUPRA" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        priceUsd: price,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("supra-price handler error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch SUPRA price" },
      { status: 500 }
    );
  }
}

// Optional: keep non-GET methods blocked explicitly (mirrors old 405 behavior)
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
