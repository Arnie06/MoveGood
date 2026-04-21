import { NextRequest, NextResponse } from "next/server";

import { readPersistedCrimeIncidents } from "@/lib/crime-data";
import { isLocalOnlyMode } from "@/lib/env";
import { MockSafetyProvider } from "@/lib/providers/mock";
import { CrimeIncident } from "@/lib/types/domain";

function parseCoordinate(value: string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isWithinBounds(incident: CrimeIncident, bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  return (
    incident.lng >= bounds.west &&
    incident.lng <= bounds.east &&
    incident.lat >= bounds.south &&
    incident.lat <= bounds.north
  );
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const west = parseCoordinate(searchParams.get("west"));
  const south = parseCoordinate(searchParams.get("south"));
  const east = parseCoordinate(searchParams.get("east"));
  const north = parseCoordinate(searchParams.get("north"));

  if (west == null || south == null || east == null || north == null) {
    return NextResponse.json(
      { error: "west, south, east, and north query parameters are required" },
      { status: 400 }
    );
  }

  const incidents = await readPersistedCrimeIncidents();
  let visibleIncidents = incidents.filter((incident) =>
    isWithinBounds(incident, { west, south, east, north })
  );

  if (visibleIncidents.length === 0 && !isLocalOnlyMode()) {
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const radiusMiles = Math.min(
      8,
      Math.max(
        0.75,
        haversineMiles(centerLat, centerLng, north, west),
        haversineMiles(centerLat, centerLng, north, east),
        haversineMiles(centerLat, centerLng, south, west),
        haversineMiles(centerLat, centerLng, south, east)
      )
    );
    const fallbackProvider = new MockSafetyProvider();
    const fallbackIncidents = await fallbackProvider.getCrimeIncidents({
      lat: centerLat,
      lng: centerLng,
      radiusMiles
    });
    visibleIncidents = fallbackIncidents.filter((incident) =>
      isWithinBounds(incident, { west, south, east, north })
    );
  }

  return NextResponse.json({
    incidents: visibleIncidents
  });
}
