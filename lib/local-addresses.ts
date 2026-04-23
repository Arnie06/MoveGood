import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { AddressSuggestion, GeocodedLocation } from "@/lib/types/domain";

const ADDRESS_DATASET_DIR = path.join(process.cwd(), "data", "addresses", "la-addresses");
const MANIFEST_PATH = path.join(ADDRESS_DATASET_DIR, "manifest.json");
const SEARCH_SHARDS_DIR = path.join(ADDRESS_DATASET_DIR, "search");
const REVERSE_SHARDS_DIR = path.join(ADDRESS_DATASET_DIR, "reverse");
const DEFAULT_SEARCH_SHARD_PREFIX_LENGTH = 2;
const DEFAULT_REVERSE_CELL_SIZE = 0.02;

export type LocalAddressRecord = {
  id: string;
  streetAddress: string;
  canonicalAddress: string;
  city: string;
  cityAlternates: string[];
  state: string;
  zipCode: string;
  lat: number;
  lng: number;
  normalizedStreetAddress: string;
  normalizedCanonicalAddress: string;
};

type LocalAddressManifest = {
  version: 1;
  generatedAt: string;
  source: string;
  sourceUrl?: string;
  totalRecords: number;
  searchShardPrefixLength: number;
  reverseCellSize: number;
};

let manifestPromise: Promise<LocalAddressManifest | null> | null = null;
const searchShardCache = new Map<string, Promise<LocalAddressRecord[]>>();
const reverseShardCache = new Map<string, Promise<LocalAddressRecord[]>>();

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeAddressSearch(value: string) {
  return normalizeWhitespace(
    value
      .toLowerCase()
      .replace(/[.,/#-]/g, " ")
      .replace(/\b(california|ca)\b/g, " ca ")
      .replace(/\b(street)\b/g, " st ")
      .replace(/\b(avenue)\b/g, " ave ")
      .replace(/\b(boulevard)\b/g, " blvd ")
      .replace(/\b(road)\b/g, " rd ")
      .replace(/\b(drive)\b/g, " dr ")
      .replace(/\b(place)\b/g, " pl ")
      .replace(/\b(lane)\b/g, " ln ")
      .replace(/\b(court)\b/g, " ct ")
  );
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getMeaningfulTokens(value: string) {
  return value
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 &&
        token !== "ca" &&
        !/^\d{5}$/.test(token)
    );
}

function buildQueryVariants(normalizedQuery: string) {
  const variants = [normalizedQuery];
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  while (tokens.length > 3) {
    const lastToken = tokens[tokens.length - 1];
    const shouldStrip =
      lastToken === "ca" ||
      /^\d{5}$/.test(lastToken) ||
      tokens.length >= 2;

    if (!shouldStrip) break;
    tokens.pop();
    variants.push(tokens.join(" "));
  }

  return unique(variants.filter(Boolean));
}

function getSearchShardKey(normalized: string, prefixLength: number) {
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (!compact) return "_";
  return compact.slice(0, prefixLength).padEnd(prefixLength, "_");
}

function getReverseShardKey(lat: number, lng: number, cellSize: number) {
  const latBucket = Math.floor(lat / cellSize);
  const lngBucket = Math.floor(lng / cellSize);
  return `${latBucket}_${lngBucket}`;
}

function buildSearchKeys(record: LocalAddressRecord) {
  const keys = new Set<string>();
  keys.add(record.normalizedStreetAddress);
  keys.add(record.normalizedCanonicalAddress);
  if (record.zipCode) {
    keys.add(normalizeAddressSearch(`${record.streetAddress} ${record.zipCode}`));
  }

  const cities = [record.city, ...record.cityAlternates].filter(Boolean);
  for (const city of cities) {
    keys.add(normalizeAddressSearch(`${record.streetAddress} ${city}`));
    keys.add(normalizeAddressSearch(`${record.streetAddress} ${city} ${record.zipCode}`));
    keys.add(normalizeAddressSearch(`${record.streetAddress} ${city} ${record.state}`));
  }

  return Array.from(keys).filter(Boolean);
}

function toGeocodedLocation(record: LocalAddressRecord): GeocodedLocation {
  return {
    canonicalAddress: record.canonicalAddress,
    lat: record.lat,
    lng: record.lng,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode
  };
}

function toAddressSuggestion(record: LocalAddressRecord): AddressSuggestion {
  return {
    label: record.canonicalAddress,
    canonicalAddress: record.canonicalAddress,
    lat: record.lat,
    lng: record.lng,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode
  };
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

function readJsonFile<T>(filePath: string): Promise<T | null> {
  return readFile(filePath, "utf8")
    .then((raw) => JSON.parse(raw) as T)
    .catch(() => null);
}

function isLocalAddressRecord(value: unknown): value is LocalAddressRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalAddressRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.streetAddress === "string" &&
    typeof candidate.canonicalAddress === "string" &&
    typeof candidate.city === "string" &&
    Array.isArray(candidate.cityAlternates) &&
    typeof candidate.state === "string" &&
    typeof candidate.zipCode === "string" &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lng) &&
    typeof candidate.normalizedStreetAddress === "string" &&
    typeof candidate.normalizedCanonicalAddress === "string"
  );
}

export function hasLocalAddressDataset() {
  return existsSync(MANIFEST_PATH);
}

export async function ensureLocalAddressDatasetDirs() {
  await mkdir(SEARCH_SHARDS_DIR, { recursive: true });
  await mkdir(REVERSE_SHARDS_DIR, { recursive: true });
}

export async function readLocalAddressManifest() {
  if (!manifestPromise) {
    manifestPromise = readJsonFile<LocalAddressManifest>(MANIFEST_PATH);
  }

  return manifestPromise;
}

async function readShardFile(filePath: string) {
  const parsed = await readJsonFile<unknown[]>(filePath);
  return Array.isArray(parsed) ? parsed.filter(isLocalAddressRecord) : [];
}

async function getSearchShard(normalizedQuery: string) {
  const manifest = await readLocalAddressManifest();
  if (!manifest) return [];
  const key = getSearchShardKey(normalizedQuery, manifest.searchShardPrefixLength);
  if (!searchShardCache.has(key)) {
    searchShardCache.set(
      key,
      readShardFile(path.join(SEARCH_SHARDS_DIR, `${key}.json`))
    );
  }
  return searchShardCache.get(key) as Promise<LocalAddressRecord[]>;
}

async function getReverseShard(key: string) {
  if (!reverseShardCache.has(key)) {
    reverseShardCache.set(
      key,
      readShardFile(path.join(REVERSE_SHARDS_DIR, `${key}.json`))
    );
  }
  return reverseShardCache.get(key) as Promise<LocalAddressRecord[]>;
}

function scoreSearchMatch(record: LocalAddressRecord, normalizedQuery: string) {
  const keys = buildSearchKeys(record);
  const queryTokens = getMeaningfulTokens(normalizedQuery);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const key of keys) {
    if (key === normalizedQuery) {
      bestScore = Math.min(bestScore, 0);
      continue;
    }

    if (key.startsWith(normalizedQuery)) {
      bestScore = Math.min(bestScore, 10 + (key.length - normalizedQuery.length));
      continue;
    }

    if (key.includes(normalizedQuery)) {
      bestScore = Math.min(bestScore, 100 + key.indexOf(normalizedQuery));
      continue;
    }

    if (queryTokens.length > 0) {
      const keyTokens = new Set(key.split(" ").filter(Boolean));
      const matchedTokens = queryTokens.filter((token) => keyTokens.has(token)).length;
      if (matchedTokens === queryTokens.length) {
        bestScore = Math.min(bestScore, 200 + (keyTokens.size - queryTokens.length));
      }
    }
  }

  return Number.isFinite(bestScore) ? bestScore : null;
}

export async function geocodeLocalAddress(address: string) {
  const normalizedQuery = normalizeAddressSearch(address);
  if (!normalizedQuery) return null;

  const records = new Map<string, LocalAddressRecord>();
  for (const variant of buildQueryVariants(normalizedQuery)) {
    const shardRecords = await getSearchShard(variant);
    for (const record of shardRecords) {
      records.set(record.id, record);
    }
  }

  if (!records.size) return null;

  const matches = Array.from(records.values())
    .map((record) => {
      const score = scoreSearchMatch(record, normalizedQuery);
      return score == null ? null : { record, score };
    })
    .filter((entry): entry is { record: LocalAddressRecord; score: number } => entry !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.record.canonicalAddress.length - b.record.canonicalAddress.length;
    });

  return matches[0] ? toGeocodedLocation(matches[0].record) : null;
}

export async function autocompleteLocalAddress(query: string, limit = 5) {
  const normalizedQuery = normalizeAddressSearch(query);
  if (!normalizedQuery) return [];

  const records = new Map<string, LocalAddressRecord>();
  for (const variant of buildQueryVariants(normalizedQuery)) {
    const shardRecords = await getSearchShard(variant);
    for (const record of shardRecords) {
      records.set(record.id, record);
    }
  }

  if (!records.size) return [];

  return Array.from(records.values())
    .map((record) => {
      const score = scoreSearchMatch(record, normalizedQuery);
      return score == null ? null : { record, score };
    })
    .filter((entry): entry is { record: LocalAddressRecord; score: number } => entry !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.record.canonicalAddress.localeCompare(b.record.canonicalAddress);
    })
    .slice(0, limit)
    .map((entry) => toAddressSuggestion(entry.record));
}

export async function reverseGeocodeLocalAddress(input: { lat: number; lng: number }) {
  const manifest = await readLocalAddressManifest();
  if (!manifest) return null;

  const radius = 2;
  const candidates = new Map<string, LocalAddressRecord>();
  const latBucket = Math.floor(input.lat / manifest.reverseCellSize);
  const lngBucket = Math.floor(input.lng / manifest.reverseCellSize);

  for (let latOffset = -radius; latOffset <= radius; latOffset += 1) {
    for (let lngOffset = -radius; lngOffset <= radius; lngOffset += 1) {
      const key = `${latBucket + latOffset}_${lngBucket + lngOffset}`;
      const shard = await getReverseShard(key);
      for (const record of shard) {
        candidates.set(record.id, record);
      }
    }
  }

  const nearest = Array.from(candidates.values())
    .map((record) => ({
      record,
      distanceMiles: haversineMiles(input.lat, input.lng, record.lat, record.lng)
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)[0];

  if (!nearest || nearest.distanceMiles > 0.25) {
    return null;
  }

  return toGeocodedLocation(nearest.record);
}

export async function getLocalAddressesInBounds(input: {
  west: number;
  south: number;
  east: number;
  north: number;
  limit?: number;
}) {
  const manifest = await readLocalAddressManifest();
  if (!manifest) return [];

  const minLatBucket = Math.floor(input.south / manifest.reverseCellSize);
  const maxLatBucket = Math.floor(input.north / manifest.reverseCellSize);
  const minLngBucket = Math.floor(input.west / manifest.reverseCellSize);
  const maxLngBucket = Math.floor(input.east / manifest.reverseCellSize);
  const candidates = new Map<string, LocalAddressRecord>();

  for (let latBucket = minLatBucket; latBucket <= maxLatBucket; latBucket += 1) {
    for (let lngBucket = minLngBucket; lngBucket <= maxLngBucket; lngBucket += 1) {
      const shard = await getReverseShard(`${latBucket}_${lngBucket}`);
      for (const record of shard) {
        if (
          record.lng >= input.west &&
          record.lng <= input.east &&
          record.lat >= input.south &&
          record.lat <= input.north
        ) {
          candidates.set(record.id, record);
        }
      }
    }
  }

  const sorted = Array.from(candidates.values()).sort((a, b) =>
    a.canonicalAddress.localeCompare(b.canonicalAddress)
  );
  return sorted.slice(0, input.limit ?? 500).map((record) => ({
    id: record.id,
    canonicalAddress: record.canonicalAddress,
    lat: record.lat,
    lng: record.lng,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode
  }));
}

export function getLocalAddressDatasetPaths() {
  return {
    datasetDir: ADDRESS_DATASET_DIR,
    manifestPath: MANIFEST_PATH,
    searchDir: SEARCH_SHARDS_DIR,
    reverseDir: REVERSE_SHARDS_DIR
  };
}

export function buildLocalAddressRecord(input: {
  id: string;
  streetAddress: string;
  city: string;
  cityAlternates?: string[];
  state?: string;
  zipCode?: string;
  lat: number;
  lng: number;
}) {
  const cityAlternates = Array.from(
    new Set((input.cityAlternates ?? []).map(normalizeWhitespace).filter(Boolean))
  ).filter((entry) => entry.toLowerCase() !== input.city.toLowerCase());
  const state = normalizeWhitespace(input.state ?? "CA") || "CA";
  const zipCode = normalizeWhitespace(input.zipCode ?? "");
  const streetAddress = normalizeWhitespace(input.streetAddress);
  const city = normalizeWhitespace(input.city);
  const canonicalAddress = normalizeWhitespace(
    [streetAddress, city, state, zipCode].filter(Boolean).join(", ")
  );

  return {
    id: input.id,
    streetAddress,
    canonicalAddress,
    city,
    cityAlternates,
    state,
    zipCode,
    lat: input.lat,
    lng: input.lng,
    normalizedStreetAddress: normalizeAddressSearch(streetAddress),
    normalizedCanonicalAddress: normalizeAddressSearch(canonicalAddress)
  } satisfies LocalAddressRecord;
}

export function getLocalAddressShardKeys(record: LocalAddressRecord, manifest?: {
  searchShardPrefixLength?: number;
  reverseCellSize?: number;
}) {
  return {
    searchKey: getSearchShardKey(
      record.normalizedStreetAddress || record.normalizedCanonicalAddress,
      manifest?.searchShardPrefixLength ?? DEFAULT_SEARCH_SHARD_PREFIX_LENGTH
    ),
    reverseKey: getReverseShardKey(
      record.lat,
      record.lng,
      manifest?.reverseCellSize ?? DEFAULT_REVERSE_CELL_SIZE
    )
  };
}
