import { readApiCache, writeApiCache } from "@/lib/api-cache";
import { AddressSuggestion, GeocodedLocation } from "@/lib/types/domain";

const GEOCODE_CACHE_NAMESPACE = "geocoder";
const GEOCODE_CACHE_TTL_MS = Number(
  process.env.GEOCODE_CACHE_TTL_MS ?? 30 * 24 * 60 * 60 * 1000
);

function normalizeAddress(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function roundCoordinate(value: number, places: number) {
  return value.toFixed(places);
}

function isLegacyMockFallback(result: GeocodedLocation | null) {
  if (!result) return false;
  return (
    Math.abs(result.lat - 40.7128) < 0.0002 &&
    Math.abs(result.lng - -74.006) < 0.0002 &&
    result.city === "New York" &&
    result.state === "NY" &&
    result.zipCode === "10001"
  );
}

export async function readCachedGeocode(address: string) {
  const result = await readApiCache<GeocodedLocation | null>({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: ["forward", normalizeAddress(address)],
    ttlMs: GEOCODE_CACHE_TTL_MS
  });
  return isLegacyMockFallback(result) ? null : result;
}

export async function writeCachedGeocode(address: string, result: GeocodedLocation | null) {
  await writeApiCache({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: ["forward", normalizeAddress(address)],
    data: result
  });
}

export async function readCachedReverseGeocode(input: { lat: number; lng: number }) {
  return readApiCache<GeocodedLocation | null>({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: [
      "reverse",
      roundCoordinate(input.lat, 5),
      roundCoordinate(input.lng, 5)
    ],
    ttlMs: GEOCODE_CACHE_TTL_MS
  });
}

export async function writeCachedReverseGeocode(
  input: { lat: number; lng: number },
  result: GeocodedLocation | null
) {
  await writeApiCache({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: [
      "reverse",
      roundCoordinate(input.lat, 5),
      roundCoordinate(input.lng, 5)
    ],
    data: result
  });
}

export async function readCachedAutocomplete(query: string, limit: number) {
  const results = await readApiCache<AddressSuggestion[]>({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: ["autocomplete", normalizeQuery(query), limit],
    ttlMs: GEOCODE_CACHE_TTL_MS
  });
  return (results ?? []).filter(
    (result) =>
      !(
        Math.abs(result.lat - 40.7128) < 0.0002 &&
        Math.abs(result.lng - -74.006) < 0.0002 &&
        result.city === "New York" &&
        result.state === "NY" &&
        result.zipCode === "10001"
      )
  );
}

export async function writeCachedAutocomplete(
  query: string,
  limit: number,
  results: AddressSuggestion[]
) {
  await writeApiCache({
    namespace: GEOCODE_CACHE_NAMESPACE,
    keyParts: ["autocomplete", normalizeQuery(query), limit],
    data: results
  });
}
