import { DataMode } from "@/lib/types/domain";

function normalize(value?: string | null) {
  return value?.trim().toLowerCase();
}

export function getAppMode(): DataMode {
  const explicit = normalize(process.env.APP_MODE);
  if (explicit === "live" || explicit === "hybrid" || explicit === "demo") {
    return explicit;
  }

  if (process.env.RENTCAST_API_KEY || process.env.GEOAPIFY_API_KEY) {
    return "hybrid";
  }

  return "demo";
}

export function hasRentCastKey() {
  return Boolean(process.env.RENTCAST_API_KEY?.trim());
}

export function getDefaultSearchLocation() {
  if (!hasRentCastKey()) return "";
  return process.env.DEFAULT_SEARCH_LOCATION?.trim() || "Los Angeles, CA";
}

export function getProviderMode(
  provider: "listings" | "geocoder" | "routing" | "poi" | "safety"
) {
  const envMap = {
    listings: process.env.LISTING_PROVIDER,
    geocoder: process.env.GEOCODER_PROVIDER,
    routing: process.env.ROUTING_PROVIDER,
    poi: process.env.POI_PROVIDER,
    safety: process.env.SAFETY_PROVIDER
  };

  return normalize(envMap[provider]) ?? "auto";
}

export function getMapStyleUrl() {
  const explicit = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (explicit) return explicit;

  const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim();
  if (geoapifyKey) {
    return `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${geoapifyKey}`;
  }

  return "";
}
