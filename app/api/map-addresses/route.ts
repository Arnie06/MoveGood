import { NextRequest, NextResponse } from "next/server";

import { getLocalAddressesInBounds, hasLocalAddressDataset } from "@/lib/local-addresses";

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const west = parseNumber(searchParams.get("west"));
  const south = parseNumber(searchParams.get("south"));
  const east = parseNumber(searchParams.get("east"));
  const north = parseNumber(searchParams.get("north"));
  const limit = parseNumber(searchParams.get("limit")) ?? 450;

  if (west == null || south == null || east == null || north == null) {
    return NextResponse.json(
      { error: "west, south, east, and north query parameters are required" },
      { status: 400 }
    );
  }

  if (!hasLocalAddressDataset()) {
    return NextResponse.json({ addresses: [] });
  }

  try {
    const addresses = await getLocalAddressesInBounds({
      west,
      south,
      east,
      north,
      limit: Math.max(50, Math.min(1200, Math.round(limit)))
    });
    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("Failed to load map addresses", error);
    return NextResponse.json({ addresses: [] }, { status: 500 });
  }
}
