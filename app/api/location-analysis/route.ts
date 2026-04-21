import { NextResponse } from "next/server";

import { analyzeLocation } from "@/lib/demo-service";
import { getServerPreferences } from "@/lib/server-preferences";

function parseCoordinate(value: string | null) {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();
  const label = searchParams.get("label")?.trim() || undefined;
  const lat = parseCoordinate(searchParams.get("lat"));
  const lng = parseCoordinate(searchParams.get("lng"));
  const preferences = await getServerPreferences();

  const result = await analyzeLocation({
    address,
    lat,
    lng,
    label,
    preferences
  });

  if (!result) {
    return NextResponse.json(
      { error: "Location could not be analyzed." },
      { status: 404 }
    );
  }

  return NextResponse.json({ result });
}
