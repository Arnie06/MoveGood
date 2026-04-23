import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { AmenityCategory, AmenityPOI } from "@/lib/types/domain";

const LOCAL_POI_DATA_PATH = path.join(process.cwd(), "data", "pois", "los-angeles.json");

let localPoisCache:
  | {
      mtimeMs: number;
      promise: Promise<AmenityPOI[]>;
    }
  | null = null;

function isAmenityCategory(value: string): value is AmenityCategory {
  return [
    "grocery",
    "gym",
    "park",
    "restaurant",
    "coffee",
    "bar",
    "transit",
    "school",
    "doctor",
    "major-poi",
    "custom"
  ].includes(value);
}

function isAmenityPoi(value: unknown): value is AmenityPOI {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AmenityPOI>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.address === "string" &&
    typeof candidate.category === "string" &&
    isAmenityCategory(candidate.category) &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lng)
  );
}

async function loadLocalPois() {
  try {
    const raw = await readFile(LOCAL_POI_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAmenityPoi) : [];
  } catch {
    return [];
  }
}

export async function readLocalPois() {
  try {
    const fileStats = await stat(LOCAL_POI_DATA_PATH);
    const mtimeMs = fileStats.mtimeMs;

    if (!localPoisCache || localPoisCache.mtimeMs !== mtimeMs) {
      localPoisCache = {
        mtimeMs,
        promise: loadLocalPois()
      };
    }

    return localPoisCache.promise;
  } catch {
    localPoisCache = null;
    return [];
  }
}

export async function getLocalPoisInBounds(input: {
  west: number;
  south: number;
  east: number;
  north: number;
  categories?: AmenityCategory[];
}) {
  const pois = await readLocalPois();
  const allowedCategories = input.categories?.length ? new Set(input.categories) : null;

  return pois.filter((poi) => {
    const matchesCategory = !allowedCategories || allowedCategories.has(poi.category);
    return (
      matchesCategory &&
      poi.lng >= input.west &&
      poi.lng <= input.east &&
      poi.lat >= input.south &&
      poi.lat <= input.north
    );
  });
}
