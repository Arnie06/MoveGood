import { NextRequest, NextResponse } from "next/server";

import { getLocalPoisInBounds } from "@/lib/local-pois";
import { getLosAngelesAmenitiesInBounds, intersectsLosAngelesBounds } from "@/lib/los-angeles-pois";
import { getPoiProvider } from "@/lib/providers/registry";
import { MockPoiProvider } from "@/lib/providers/mock";
import { AmenityCategory, AmenityPOI } from "@/lib/types/domain";

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function filterAmenitiesToBounds(
  amenities: AmenityPOI[],
  bounds: { west: number; south: number; east: number; north: number }
) {
  return amenities.filter(
    (amenity) =>
      amenity.lng >= bounds.west &&
      amenity.lng <= bounds.east &&
      amenity.lat >= bounds.south &&
      amenity.lat <= bounds.north
  );
}

function dedupeAmenities(amenities: AmenityPOI[]) {
  return Array.from(
    new Map(
      amenities.map((amenity) => [
        `${amenity.category}:${amenity.id}:${amenity.lat.toFixed(5)}:${amenity.lng.toFixed(5)}`,
        amenity
      ])
    ).values()
  );
}

function getMissingCategories(
  requestedCategories: AmenityCategory[] | undefined,
  amenities: AmenityPOI[]
) {
  if (!requestedCategories?.length) {
    return undefined;
  }

  const presentCategories = new Set(amenities.map((amenity) => amenity.category));
  const missing = requestedCategories.filter((category) => !presentCategories.has(category));
  return missing.length > 0 ? missing : [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const west = parseNumber(searchParams.get("west"));
  const south = parseNumber(searchParams.get("south"));
  const east = parseNumber(searchParams.get("east"));
  const north = parseNumber(searchParams.get("north"));

  if (west == null || south == null || east == null || north == null) {
    return NextResponse.json({ amenities: [] }, { status: 400 });
  }

  const categories = searchParams
    .get("categories")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) as AmenityCategory[] | undefined;

  try {
    const bounds = { west, south, east, north };
    const localAmenities = await getLocalPoisInBounds({
      west,
      south,
      east,
      north,
      categories
    });
    let combinedAmenities = [...localAmenities];
    let missingCategories = getMissingCategories(categories, combinedAmenities);

    const isWithinCountyCacheRegion = intersectsLosAngelesBounds(bounds);
    if (isWithinCountyCacheRegion && missingCategories !== undefined ? missingCategories.length > 0 : true) {
      const visibleAmenities = await getLosAngelesAmenitiesInBounds({
        west,
        south,
        east,
        north,
        categories: missingCategories === undefined ? categories : missingCategories
      });
      combinedAmenities = dedupeAmenities([...combinedAmenities, ...visibleAmenities]);
      missingCategories = getMissingCategories(categories, combinedAmenities);
    }

    const poiProvider = getPoiProvider();
    const fallbackPoiProvider = new MockPoiProvider();
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const radiusMiles = Math.max(
      haversineMiles(centerLat, centerLng, north, west),
      haversineMiles(centerLat, centerLng, north, east),
      haversineMiles(centerLat, centerLng, south, west),
      haversineMiles(centerLat, centerLng, south, east)
    );

    const providerRequest = {
      lat: centerLat,
      lng: centerLng,
      radiusMiles: Math.min(8, Math.max(0.75, radiusMiles)),
      categories: missingCategories === undefined ? categories : missingCategories
    };

    if (providerRequest.categories === undefined || providerRequest.categories.length > 0) {
      const amenities = await poiProvider.getNearbyAmenities(providerRequest);
      combinedAmenities = dedupeAmenities([
        ...combinedAmenities,
        ...filterAmenitiesToBounds(amenities, bounds)
      ]);
    }

    if (combinedAmenities.length === 0) {
      const fallbackAmenities = await fallbackPoiProvider.getNearbyAmenities(providerRequest);
      combinedAmenities = filterAmenitiesToBounds(fallbackAmenities, bounds);
    }

    return NextResponse.json({ amenities: combinedAmenities });
  } catch (error) {
    console.error("Failed to load map POIs", error);
    return NextResponse.json({ amenities: [] }, { status: 500 });
  }
}
