import { NextResponse } from "next/server";

import { analyzeLocation } from "@/lib/demo-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();
  const label = searchParams.get("label")?.trim() || undefined;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  const result = await analyzeLocation({
    address,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    label
  });

  if (!result) {
    return NextResponse.json(
      { error: "Location could not be analyzed." },
      { status: 404 }
    );
  }

  return NextResponse.json({ result });
}
