import { mockAmenities, mockSourceRecords } from "@/lib/data/mock-data";
import { getApiCacheTtlMs, readApiCache, writeApiCache } from "@/lib/api-cache";
import {
  buildCrimeMetricsFromIncidents,
  categorizeCrimeLabel,
  readPersistedCrimeIncidents
} from "@/lib/crime-data";
import {
  GeocoderProvider,
  PoiProvider,
  RoutingProvider,
  SafetyProvider
} from "@/lib/providers/interfaces";
import { MockGeocoderProvider } from "@/lib/providers/mock";
import {
  AddressSuggestion,
  AmenityCategory,
  AmenityPOI,
  CrimeIncident,
  CrimeIncidentCategory,
  CrimeMetric,
  GeocodedLocation,
  Property,
  RouteMetric,
  SavedPlace
} from "@/lib/types/domain";
import { consumeGeoapifyBudget } from "@/lib/geoapify-budget";
import { clampScore, slugify } from "@/lib/utils";

const fallbackGeocoder = new MockGeocoderProvider();
const LIVE_API_CACHE_TTL_MS = getApiCacheTtlMs(
  Number(process.env.LIVE_API_CACHE_TTL_MS ?? 72 * 60 * 60 * 1000)
);

type CachedRequestInit = RequestInit & {
  next?: { revalidate?: number };
  cacheOptions?: {
    namespace?: string;
    ttlMs?: number;
    keyParts?: Array<string | number | undefined>;
  };
};

function normalizeCacheBody(body: RequestInit["body"]) {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body == null) return "";
  return String(body);
}

function buildRequestCacheKeyParts(input: string, init?: CachedRequestInit) {
  if (init?.cacheOptions?.keyParts?.length) {
    return init.cacheOptions.keyParts;
  }

  return [input, init?.method ?? "GET", normalizeCacheBody(init?.body)];
}

async function fetchJson<T>(
  input: string,
  init?: CachedRequestInit
): Promise<T> {
  const ttlMs = init?.cacheOptions?.ttlMs ?? LIVE_API_CACHE_TTL_MS;
  const namespace = init?.cacheOptions?.namespace ?? "live-api";
  const keyParts = buildRequestCacheKeyParts(input, init);
  const cached = await readApiCache<T>({
    namespace,
    keyParts,
    ttlMs
  });
  if (cached !== null) {
    return cached;
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {})
    },
    next: {
      revalidate: init?.next?.revalidate ?? Math.round(ttlMs / 1000)
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as T;
  await writeApiCache({
    namespace,
    keyParts,
    data: payload
  });
  return payload;
}

async function fetchGeoapifyJson<T>(
  input: string,
  init: CachedRequestInit,
  budget: { kind: string; credits?: number }
): Promise<T> {
  const ttlMs = init.cacheOptions?.ttlMs ?? LIVE_API_CACHE_TTL_MS;
  const keyParts = buildRequestCacheKeyParts(input, init);
  const cached = await readApiCache<T>({
    namespace: "geoapify",
    keyParts,
    ttlMs
  });
  if (cached !== null) {
    return cached;
  }

  await consumeGeoapifyBudget({
    kind: budget.kind,
    target: input,
    credits: budget.credits
  });

  return fetchJson<T>(input, {
    ...init,
    cacheOptions: {
      ...init.cacheOptions,
      namespace: "geoapify",
      ttlMs,
      keyParts
    }
  });
}

function toMilesLatitudeDelta(radiusMiles: number) {
  return radiusMiles / 69;
}

function toMilesLongitudeDelta(radiusMiles: number, latitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const cosine = Math.max(0.2, Math.cos(latitudeRadians));
  return radiusMiles / (69 * cosine);
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

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFiniteCoordinatePair(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCoordinatePair(value: unknown) {
  if (!value) return null;

  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    const lat =
      parseNumber(record.latitude) ??
      parseNumber(record.lat) ??
      parseNumber(record.y);
    const lng =
      parseNumber(record.longitude) ??
      parseNumber(record.lon) ??
      parseNumber(record.lng) ??
      parseNumber(record.x);
    if (lat != null && lng != null) {
      return { lat, lng };
    }
  }

  if (typeof value === "string") {
    const pointMatch = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (pointMatch) {
      return {
        lat: Number(pointMatch[2]),
        lng: Number(pointMatch[1])
      };
    }

    const tupleMatch = value.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/);
    if (tupleMatch) {
      return {
        lat: Number(tupleMatch[1]),
        lng: Number(tupleMatch[2])
      };
    }
  }

  return null;
}

function startOfRecentWindow(daysBack: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date;
}

function selectRouteDestinations(input: {
  propertyLat: number;
  propertyLng: number;
  destinations: Array<SavedPlace | AmenityPOI>;
  maxDestinations: number;
}) {
  const validDestinations = input.destinations.filter((destination) =>
    isFiniteCoordinatePair(destination.lat, destination.lng)
  );
  const savedPlaces = validDestinations.filter(
    (destination): destination is SavedPlace => "includeInScoring" in destination
  );
  const amenities = validDestinations.filter(
    (destination): destination is AmenityPOI => !("includeInScoring" in destination)
  );
  const uniqueById = new Map<string, SavedPlace | AmenityPOI>();

  const sortedAmenities = [...amenities].sort(
    (a, b) =>
      haversineMiles(input.propertyLat, input.propertyLng, a.lat, a.lng) -
      haversineMiles(input.propertyLat, input.propertyLng, b.lat, b.lng)
  );

  savedPlaces.forEach((destination) => {
    uniqueById.set(destination.id, destination);
  });

  for (const category of ["grocery", "gym", "park", "restaurant", "coffee", "bar"] satisfies AmenityCategory[]) {
    const nearestByCategory = sortedAmenities.find((destination) => destination.category === category);
    if (nearestByCategory) {
      uniqueById.set(nearestByCategory.id, nearestByCategory);
    }
  }

  for (const destination of sortedAmenities) {
    if (uniqueById.size >= input.maxDestinations) break;
    uniqueById.set(destination.id, destination);
  }

  return Array.from(uniqueById.values()).slice(0, input.maxDestinations);
}

function buildApproximateRouteMetrics(input: {
  propertyId: string;
  propertyLat: number;
  propertyLng: number;
  destinations: Array<SavedPlace | AmenityPOI>;
  sourceName: string;
}): RouteMetric[] {
  return input.destinations.map((destination) => {
    const distanceMiles = haversineMiles(
      input.propertyLat,
      input.propertyLng,
      destination.lat,
      destination.lng
    );
    const walkingMinutes = Math.max(3, Math.round(distanceMiles * 20));
    const driveMinutesOffPeak = Math.max(2, Math.round(distanceMiles * 4.5));
    const driveMinutesPeak = Math.max(
      driveMinutesOffPeak + 2,
      Math.round(driveMinutesOffPeak * 1.4)
    );

    return {
      id: `${input.propertyId}-${destination.id}`,
      propertyId: input.propertyId,
      destinationType:
        "includeInScoring" in destination ? "saved-place" : destination.category,
      destinationId: destination.id,
      destinationLabel: "label" in destination ? destination.label : destination.name,
      walkingMinutes,
      driveMinutesOffPeak,
      driveMinutesPeak,
      sourceName: input.sourceName,
      updatedAt: new Date().toISOString()
    };
  });
}

const SAFETY_LOOKBACK_DAYS = Number(process.env.SAFETY_LOOKBACK_DAYS ?? 730);

function isLosAngelesCoordinate(lat: number, lng: number) {
  return lat >= 33.65 && lat <= 34.35 && lng >= -118.75 && lng <= -117.95;
}

type LapdDatasetConfig = {
  id: string;
  label: string;
};

type LapdDatasetSchema = {
  latKey?: string;
  lngKey?: string;
  dateKey?: string;
  offenseKey?: string;
  addressKey?: string;
};

const lapdDatasets: LapdDatasetConfig[] = [
  { id: "k7nn-b2ep", label: "LAPD NIBRS Offenses 2026+" },
  { id: "y8y3-fqfu", label: "LAPD NIBRS Offenses 2024-2025" },
  { id: "2nrs-mtv8", label: "LAPD Crime Data 2020-2024" }
];

function inferSchemaFromSample(sample: Record<string, unknown>): LapdDatasetSchema {
  const keys = Object.keys(sample);
  const findKey = (candidates: string[]) =>
    keys.find((key) =>
      candidates.some(
        (candidate) =>
          key === candidate ||
          key.includes(candidate) ||
          key.replace(/_/g, "").includes(candidate.replace(/_/g, ""))
      )
    );

  return {
    latKey: findKey(["lat", "latitude"]),
    lngKey: findKey(["lon", "lng", "longitude"]),
    dateKey: findKey(["date_occ", "occurred", "incident_date", "reported_date", "date_rptd"]),
    offenseKey: findKey(["crm_cd_desc", "offense", "crime_description", "charge_description"]),
    addressKey: findKey(["location", "block_address", "address", "street"])
  };
}

function getRowCoordinates(
  row: Record<string, unknown>,
  schema: LapdDatasetSchema
) {
  const directLat =
    (schema.latKey ? parseNumber(row[schema.latKey]) : null) ??
    parseNumber(row.latitude) ??
    parseNumber(row.lat);
  const directLng =
    (schema.lngKey ? parseNumber(row[schema.lngKey]) : null) ??
    parseNumber(row.longitude) ??
    parseNumber(row.lon) ??
    parseNumber(row.lng);

  if (directLat != null && directLng != null) {
    return { lat: directLat, lng: directLng };
  }

  const locationValue = Object.entries(row).find(([key]) =>
    ["lat_lon", "location", "location_1", "coordinates", "geocoded_column"].some((candidate) =>
      key.toLowerCase().includes(candidate)
    )
  )?.[1];

  return parseCoordinatePair(locationValue);
}

function getRowDate(row: Record<string, unknown>, schema: LapdDatasetSchema) {
  const candidates = [
    schema.dateKey ? row[schema.dateKey] : undefined,
    row.date_occ,
    row.date_rptd,
    row.occurred_at,
    row.reported_date,
    row.incident_date
  ];

  for (const candidate of candidates) {
    const parsed = parseDate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function getRowOffenseLabel(row: Record<string, unknown>, schema: LapdDatasetSchema) {
  const candidates = [
    schema.offenseKey ? row[schema.offenseKey] : undefined,
    row.crm_cd_desc,
    row.offense,
    row.offense_description,
    row.charge_description,
    row.part_1_2
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "Reported offense";
}

function getRowAddress(row: Record<string, unknown>, schema: LapdDatasetSchema) {
  const candidates = [
    schema.addressKey ? row[schema.addressKey] : undefined,
    row.location,
    row.block_address,
    row.cross_street,
    row.address
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

export class GeoapifyGeocoderProvider implements GeocoderProvider {
  name = "geoapify-geocoder";

  private apiKey = process.env.GEOAPIFY_API_KEY;

  async geocode(address: string) {
    if (!this.apiKey) return fallbackGeocoder.geocode(address);

    const params = new URLSearchParams({
      text: address,
      format: "json",
      limit: "1",
      apiKey: this.apiKey
    });
    const payload = await fetchGeoapifyJson<{ results?: Array<Record<string, unknown>> }>(
      `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
      {},
      { kind: "geocode" }
    );
    const result = payload.results?.[0];
    if (!result) return null;

    return {
      canonicalAddress: String(result.formatted ?? address),
      lat: Number(result.lat ?? 0),
      lng: Number(result.lon ?? 0),
      city: String(result.city ?? ""),
      state: String(result.state_code ?? result.state ?? ""),
      zipCode: String(result.postcode ?? "")
    };
  }

  async reverseGeocode(input: { lat: number; lng: number }) {
    if (!this.apiKey) return fallbackGeocoder.reverseGeocode(input);

    const params = new URLSearchParams({
      lat: String(input.lat),
      lon: String(input.lng),
      format: "json",
      apiKey: this.apiKey
    });
    const payload = await fetchGeoapifyJson<{ results?: Array<Record<string, unknown>> }>(
      `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`,
      {},
      { kind: "reverse-geocode" }
    );
    const result = payload.results?.[0];
    if (!result) return null;

    return {
      canonicalAddress: String(result.formatted ?? `${input.lat}, ${input.lng}`),
      lat: Number(result.lat ?? input.lat),
      lng: Number(result.lon ?? input.lng),
      city: String(result.city ?? ""),
      state: String(result.state_code ?? result.state ?? ""),
      zipCode: String(result.postcode ?? "")
    };
  }

  async autocomplete(query: string, limit = 5) {
    if (!query.trim()) return [];
    if (!this.apiKey) return fallbackGeocoder.autocomplete(query, limit);

    const params = new URLSearchParams({
      text: query,
      format: "json",
      limit: String(limit),
      apiKey: this.apiKey
    });
    const payload = await fetchGeoapifyJson<{ results?: Array<Record<string, unknown>> }>(
      `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
      {},
      { kind: "autocomplete" }
    );

    return (payload.results ?? []).map((result) => ({
      label: String(result.formatted ?? query),
      canonicalAddress: String(result.formatted ?? query),
      lat: Number(result.lat ?? 0),
      lng: Number(result.lon ?? 0),
      city: String(result.city ?? ""),
      state: String(result.state_code ?? result.state ?? ""),
      zipCode: String(result.postcode ?? "")
    }));
  }
}

function parsePeliasFeature(
  feature: Record<string, unknown>,
  fallbackLabel: string
): GeocodedLocation | null {
  const geometry = (feature.geometry as Record<string, unknown> | undefined) ?? {};
  const coordinates = Array.isArray(geometry.coordinates)
    ? geometry.coordinates
    : [];
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const properties = (feature.properties as Record<string, unknown> | undefined) ?? {};
  return {
    canonicalAddress: String(
      properties.label ??
      properties.name ??
      properties.formatted ??
      fallbackLabel
    ),
    lat,
    lng: lon,
    city: String(properties.locality ?? properties.localadmin ?? properties.county ?? ""),
    state: String(properties.region_a ?? properties.region ?? ""),
    zipCode: String(properties.postalcode ?? "")
  };
}

export class LocalPeliasGeocoderProvider implements GeocoderProvider {
  name = "local-pelias-geocoder";

  private baseUrl = process.env.LOCAL_GEOCODER_BASE_URL?.trim().replace(/\/+$/, "");

  async geocode(address: string) {
    if (!this.baseUrl) return fallbackGeocoder.geocode(address);

    const params = new URLSearchParams({
      text: address,
      size: "1"
    });
    const payload = await fetchJson<{ features?: Array<Record<string, unknown>> }>(
      `${this.baseUrl}/v1/search?${params.toString()}`,
      {
        cacheOptions: {
          namespace: "local-geocoder",
          keyParts: ["search", address]
        }
      }
    );

    return parsePeliasFeature(payload.features?.[0] ?? {}, address);
  }

  async reverseGeocode(input: { lat: number; lng: number }) {
    if (!this.baseUrl) return fallbackGeocoder.reverseGeocode(input);

    const params = new URLSearchParams({
      "point.lat": String(input.lat),
      "point.lon": String(input.lng),
      size: "1"
    });
    const payload = await fetchJson<{ features?: Array<Record<string, unknown>> }>(
      `${this.baseUrl}/v1/reverse?${params.toString()}`,
      {
        cacheOptions: {
          namespace: "local-geocoder",
          keyParts: ["reverse", input.lat.toFixed(5), input.lng.toFixed(5)]
        }
      }
    );

    return parsePeliasFeature(
      payload.features?.[0] ?? {},
      `${input.lat}, ${input.lng}`
    );
  }

  async autocomplete(query: string, limit = 5) {
    if (!query.trim()) return [];
    if (!this.baseUrl) return fallbackGeocoder.autocomplete(query, limit);

    const params = new URLSearchParams({
      text: query,
      size: String(limit)
    });
    const payload = await fetchJson<{ features?: Array<Record<string, unknown>> }>(
      `${this.baseUrl}/v1/autocomplete?${params.toString()}`,
      {
        cacheOptions: {
          namespace: "local-geocoder",
          keyParts: ["autocomplete", query, limit]
        }
      }
    );

    return (payload.features ?? [])
      .map((feature) => {
        const parsed = parsePeliasFeature(feature, query);
        if (!parsed) return null;

        return {
          label: parsed.canonicalAddress,
          canonicalAddress: parsed.canonicalAddress,
          lat: parsed.lat,
          lng: parsed.lng,
          city: parsed.city,
          state: parsed.state,
          zipCode: parsed.zipCode
        };
      })
      .filter((result): result is AddressSuggestion => result !== null);
  }
}

const geoapifyCategoryMap: Record<AmenityCategory, string[]> = {
  grocery: ["commercial.supermarket", "commercial.food_and_drink"],
  gym: ["sport.fitness"],
  park: [
    "leisure.park",
    "leisure.park.garden",
    "leisure.park.nature_reserve",
    "national_park",
    "natural",
    "natural.protected_area"
  ],
  restaurant: ["catering.restaurant", "catering.fast_food", "catering.food_court"],
  coffee: ["catering.cafe"],
  bar: ["catering.bar", "catering.pub"],
  transit: ["public_transport"],
  school: ["education.school"],
  doctor: ["healthcare.doctor", "healthcare.hospital"],
  "major-poi": ["tourism", "entertainment"],
  custom: ["service"]
};

export class GeoapifyPoiProvider implements PoiProvider {
  name = "geoapify-poi";

  private apiKey = process.env.GEOAPIFY_API_KEY;
  private static readonly PAGE_LIMIT = 20;

  private mapFeatureToAmenity(
    feature: Record<string, unknown>,
    fallbackCategory: AmenityCategory,
    index: number
  ): AmenityPOI {
    const properties = (feature.properties as Record<string, unknown>) ?? {};
    const rawCategories = Array.isArray(properties.categories)
      ? properties.categories.map(String)
      : [];
    const category =
      (Object.entries(geoapifyCategoryMap).find(([, values]) =>
        rawCategories.some((entry) => values.some((value) => entry.startsWith(value)))
      )?.[0] as AmenityCategory | undefined) ?? fallbackCategory;

    return {
      id: String(properties.place_id ?? `${category}-${index}`),
      name: String(properties.name ?? properties.address_line1 ?? "Nearby place"),
      category,
      lat: Number(properties.lat ?? 0),
      lng: Number(properties.lon ?? 0),
      address: String(properties.formatted ?? properties.address_line2 ?? "Address unavailable"),
      metadata: properties
    };
  }

  async getNearbyAmenities(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
    categories?: AmenityCategory[];
  }): Promise<AmenityPOI[]> {
    if (!this.apiKey) {
      return getOpenStreetMapAmenities(input);
    }

    const requestedCategories: AmenityCategory[] = input.categories?.length
      ? input.categories
      : ["grocery", "gym", "park", "restaurant", "coffee", "bar"];
    const radiusMeters = Math.round(input.radiusMiles * 1609.34);
    try {
      const groups = await Promise.all(
        requestedCategories.map(async (category) => {
          const matches: AmenityPOI[] = [];
          let offset = 0;

          try {
            while (true) {
              const params = new URLSearchParams({
                categories: geoapifyCategoryMap[category].join(","),
                filter: `circle:${input.lng},${input.lat},${radiusMeters}`,
                bias: `proximity:${input.lng},${input.lat}`,
                limit: String(GeoapifyPoiProvider.PAGE_LIMIT),
                offset: String(offset),
                apiKey: this.apiKey as string
              });
              const payload = await fetchGeoapifyJson<{ features?: Array<Record<string, unknown>> }>(
                `https://api.geoapify.com/v2/places?${params.toString()}`,
                {},
                { kind: `places-${category}` }
              );
              const features = payload.features ?? [];
              matches.push(
                ...features.map((feature, index) =>
                  this.mapFeatureToAmenity(feature, category, offset + index)
                )
              );

              if (features.length < GeoapifyPoiProvider.PAGE_LIMIT) {
                break;
              }

              offset += GeoapifyPoiProvider.PAGE_LIMIT;
            }
          } catch (error) {
            console.warn(`Geoapify POI lookup failed for ${category}`, error);
          }

          return matches;
        })
      );

      const flattened = groups.flat();
      if (flattened.length === 0) {
        return getOpenStreetMapAmenities(input);
      }

      return Array.from(
        new Map(
          flattened
            .map((amenity) => [
              `${amenity.category}:${amenity.id}:${amenity.lat.toFixed(5)}:${amenity.lng.toFixed(5)}`,
              amenity
            ])
        ).values()
      ).sort(
        (a, b) =>
          haversineMiles(input.lat, input.lng, a.lat, a.lng) -
          haversineMiles(input.lat, input.lng, b.lat, b.lng)
      );
    } catch {
      return getOpenStreetMapAmenities(input);
    }
  }
}

async function getOpenStreetMapAmenities(input: {
  lat: number;
  lng: number;
  radiusMiles: number;
  categories?: AmenityCategory[];
}): Promise<AmenityPOI[]> {
  const requestedCategories: AmenityCategory[] = input.categories?.length
    ? input.categories
    : ["grocery", "gym", "park", "restaurant", "coffee", "bar"];
  const radiusMeters = Math.round(input.radiusMiles * 1609.34);
  const categoryQueries: Record<AmenityCategory, string[]> = {
    grocery: ['node["shop"~"supermarket|grocery|convenience"]', 'way["shop"~"supermarket|grocery|convenience"]'],
    gym: ['node["leisure"="fitness_centre"]', 'way["leisure"="fitness_centre"]', 'node["sport"="fitness"]'],
    park: [
      'node["leisure"~"park|garden|nature_reserve|playground"]',
      'way["leisure"~"park|garden|nature_reserve|playground"]',
      'node["boundary"="national_park"]',
      'way["boundary"="national_park"]'
    ],
    restaurant: ['node["amenity"~"restaurant|fast_food|food_court"]', 'way["amenity"~"restaurant|fast_food|food_court"]'],
    coffee: ['node["amenity"="cafe"]', 'way["amenity"="cafe"]'],
    bar: ['node["amenity"~"bar|pub"]', 'way["amenity"~"bar|pub"]'],
    transit: [],
    school: [],
    doctor: [],
    "major-poi": [],
    custom: []
  };

  const queryBody = requestedCategories
    .flatMap((category) =>
      categoryQueries[category].map(
        (clause) => `${clause}(around:${radiusMeters},${input.lat},${input.lng});`
      )
    )
    .join("");

  if (!queryBody) return [];

  try {
    const payload = await fetchJson<{
      elements?: Array<Record<string, unknown>>;
    }>("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: `[out:json][timeout:20];(${queryBody});out center;`,
      next: { revalidate: 21600 }
    });

    return (payload.elements ?? [])
      .map((element, index): AmenityPOI | null => {
        const tags = (element.tags as Record<string, unknown> | undefined) ?? {};
        const center = (element.center as Record<string, unknown> | undefined) ?? {};
        const lat = parseNumber(element.lat) ?? parseNumber(center.lat);
        const lng = parseNumber(element.lon) ?? parseNumber(center.lon);
        if (lat == null || lng == null) return null;

        const category = requestedCategories.find((candidate) => {
          if (candidate === "grocery") return ["supermarket", "grocery", "convenience"].includes(String(tags.shop ?? ""));
          if (candidate === "gym") return String(tags.leisure ?? "") === "fitness_centre" || String(tags.sport ?? "") === "fitness";
          if (candidate === "park") {
            return ["park", "garden", "nature_reserve", "playground"].includes(
              String(tags.leisure ?? "")
            ) || String(tags.boundary ?? "") === "national_park";
          }
          if (candidate === "restaurant") return ["restaurant", "fast_food", "food_court"].includes(String(tags.amenity ?? ""));
          if (candidate === "coffee") return String(tags.amenity ?? "") === "cafe";
          if (candidate === "bar") return ["bar", "pub"].includes(String(tags.amenity ?? ""));
          return false;
        }) ?? "major-poi";

        return {
          id: String(element.id ?? `${category}-${index}`),
          name: String(tags.name ?? tags.brand ?? `${category} nearby`),
          category,
          lat,
          lng,
          address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
            .filter((value) => typeof value === "string" && value.trim())
            .join(" ")
            || "Address unavailable",
          metadata: tags
        } satisfies AmenityPOI;
      })
      .filter((amenity): amenity is AmenityPOI => amenity !== null);
  } catch {
    return mockAmenities.filter((amenity) => haversineMiles(input.lat, input.lng, amenity.lat, amenity.lng) <= input.radiusMiles + 0.25);
  }
}

export class GeoapifyRoutingProvider implements RoutingProvider {
  name = "geoapify-routing";

  private apiKey = process.env.GEOAPIFY_API_KEY;

  async getRouteMetrics(input: {
    propertyId: string;
    propertyLat: number;
    propertyLng: number;
    destinations: Array<SavedPlace | AmenityPOI>;
    includeTraffic?: boolean;
  }): Promise<RouteMetric[]> {
    if (!this.apiKey || input.destinations.length === 0) return [];

    const validDestinations = selectRouteDestinations({
      propertyLat: input.propertyLat,
      propertyLng: input.propertyLng,
      destinations: input.destinations,
      maxDestinations: 12
    });

    if (
      !isFiniteCoordinatePair(input.propertyLat, input.propertyLng) ||
      validDestinations.length === 0
    ) {
      return [];
    }

    const origin = { location: [input.propertyLng, input.propertyLat] };
    const targets = validDestinations.map((destination) => ({
      location: [destination.lng, destination.lat]
    }));

    const drivePeakBody = {
      mode: "drive",
      traffic: input.includeTraffic ? "approximated" : "free_flow",
      sources: [origin],
      targets
    };
    const driveOffPeakBody = {
      mode: "drive",
      traffic: "free_flow",
      sources: [origin],
      targets
    };
    const walkBody = {
      mode: "walk",
      sources: [origin],
      targets
    };

    try {
      const [driveOffPeak, drivePeak, walk] = await Promise.all([
        fetchGeoapifyJson<{ sources_to_targets?: Array<Array<{ time: number }>> }>(
          `https://api.geoapify.com/v1/routematrix?apiKey=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(driveOffPeakBody)
          },
          { kind: "route-matrix" }
        ),
        fetchGeoapifyJson<{ sources_to_targets?: Array<Array<{ time: number }>> }>(
          `https://api.geoapify.com/v1/routematrix?apiKey=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(drivePeakBody)
          },
          { kind: "route-matrix" }
        ),
        fetchGeoapifyJson<{ sources_to_targets?: Array<Array<{ time: number }>> }>(
          `https://api.geoapify.com/v1/routematrix?apiKey=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(walkBody)
          },
          { kind: "route-matrix" }
        )
      ]);

      return validDestinations.map((destination, index) => ({
        id: `${input.propertyId}-${destination.id}`,
        propertyId: input.propertyId,
        destinationType:
          "includeInScoring" in destination ? "saved-place" : destination.category,
        destinationId: destination.id,
        destinationLabel: "label" in destination ? destination.label : destination.name,
        walkingMinutes:
          Math.round((walk.sources_to_targets?.[0]?.[index]?.time ?? 0) / 60) || undefined,
        driveMinutesOffPeak:
          Math.round((driveOffPeak.sources_to_targets?.[0]?.[index]?.time ?? 0) / 60) ||
          undefined,
        driveMinutesPeak:
          Math.round((drivePeak.sources_to_targets?.[0]?.[index]?.time ?? 0) / 60) ||
          undefined,
        sourceName: "Geoapify",
        updatedAt: new Date().toISOString()
      }));
    } catch {
      return buildApproximateRouteMetrics({
        propertyId: input.propertyId,
        propertyLat: input.propertyLat,
        propertyLng: input.propertyLng,
        destinations: validDestinations,
        sourceName: "Geoapify fallback"
      });
    }
  }
}

export class LAPDSafetyProvider implements SafetyProvider {
  name = "regional-safety";

  private allowRemoteCrimeFetch =
    process.env.ENABLE_REMOTE_CRIME_FETCH?.trim().toLowerCase() === "true";

  private schemaCache = new Map<string, LapdDatasetSchema>();

  private incidentsCache = new Map<string, Promise<CrimeIncident[]>>();

  private localIncidentsPromise?: Promise<CrimeIncident[]>;

  private getLocalIncidents() {
    if (!this.localIncidentsPromise) {
      this.localIncidentsPromise = readPersistedCrimeIncidents();
    }

    return this.localIncidentsPromise;
  }

  private async getDatasetSchema(datasetId: string) {
    if (this.schemaCache.has(datasetId)) {
      return this.schemaCache.get(datasetId) as LapdDatasetSchema;
    }

    try {
      const sample = await fetchJson<Record<string, unknown>[]>(
        `https://data.lacity.org/resource/${datasetId}.json?$limit=1`
      );
      const schema = inferSchemaFromSample(sample[0] ?? {});
      this.schemaCache.set(datasetId, schema);
      return schema;
    } catch {
      const emptySchema: LapdDatasetSchema = {};
      this.schemaCache.set(datasetId, emptySchema);
      return emptySchema;
    }
  }

  private buildCacheKey(input: { lat: number; lng: number; radiusMiles: number }) {
    return [
      input.radiusMiles.toFixed(2),
      input.lat.toFixed(3),
      input.lng.toFixed(3)
    ].join(":");
  }

  private async fetchDatasetIncidents(
    dataset: LapdDatasetConfig,
    input: { lat: number; lng: number; radiusMiles: number }
  ) {
    const schema = await this.getDatasetSchema(dataset.id);
    const params = new URLSearchParams({
      $limit: "900"
    });
    if (schema.dateKey) {
      params.set("$order", `${schema.dateKey} DESC`);
    }

    try {
      const rows = await fetchJson<Record<string, unknown>[]>(
        `https://data.lacity.org/resource/${dataset.id}.json?${params.toString()}`,
        { next: { revalidate: 43200 } }
      );

      const recentWindow = startOfRecentWindow(SAFETY_LOOKBACK_DAYS);
      const incidents = rows
        .map((row, index): CrimeIncident | null => {
          const coordinates = getRowCoordinates(row, schema);
          const occurredAt = getRowDate(row, schema);
          if (!coordinates || !occurredAt) return null;
          const { lat, lng } = coordinates;
          if (!isLosAngelesCoordinate(lat, lng)) return null;
          if (occurredAt < recentWindow) return null;
          if (haversineMiles(input.lat, input.lng, lat, lng) > input.radiusMiles) return null;

          const label = getRowOffenseLabel(row, schema);
          const blockAddress = getRowAddress(row, schema);

          return {
            id: `${dataset.id}-${String(row.dr_no ?? row.id ?? row.report_id ?? index)}`,
            geoId: `${input.lat.toFixed(4)},${input.lng.toFixed(4)}`,
            lat,
            lng,
            category: categorizeCrimeLabel(label),
            label,
            blockAddress,
            occurredAt: occurredAt.toISOString(),
            sourceName: dataset.label,
            metadata: row
          } satisfies CrimeIncident;
        })
        .filter((incident): incident is CrimeIncident => incident !== null);

      return incidents;
    } catch {
      return [];
    }
  }

  async getCrimeIncidents(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
  }): Promise<CrimeIncident[]> {
    const cacheKey = this.buildCacheKey(input);
    if (!this.incidentsCache.has(cacheKey)) {
      this.incidentsCache.set(
        cacheKey,
        Promise.all([
          this.getLocalIncidents().then((incidents) => {
            const recentWindow = startOfRecentWindow(SAFETY_LOOKBACK_DAYS);

            return incidents.filter((incident) => {
              const occurredAt = new Date(incident.occurredAt);
              if (Number.isNaN(occurredAt.getTime()) || occurredAt < recentWindow) return false;

              return (
                haversineMiles(input.lat, input.lng, incident.lat, incident.lng) <=
                input.radiusMiles
              );
            });
          }),
          this.allowRemoteCrimeFetch && isLosAngelesCoordinate(input.lat, input.lng)
            ? Promise.all(lapdDatasets.map((dataset) => this.fetchDatasetIncidents(dataset, input))).then(
                (groups) => groups.flat()
              )
            : Promise.resolve([])
        ]).then(([localIncidents, lapdIncidents]) => {
          const deduped = new Map<string, CrimeIncident>();

          [...localIncidents, ...lapdIncidents].forEach((incident) => {
            if (!incident) return;
            deduped.set(incident.id, incident);
          });

          return Array.from(deduped.values())
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
            .slice(0, 300);
        })
      );
    }

    return this.incidentsCache.get(cacheKey) as Promise<CrimeIncident[]>;
  }

  async getSafetyMetrics(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
  }): Promise<CrimeMetric[]> {
    const incidents = await this.getCrimeIncidents(input);
    if (!incidents.length) return [];

    return buildCrimeMetricsFromIncidents({
      incidents,
      lat: input.lat,
      lng: input.lng,
      radiusMiles: input.radiusMiles,
      sourceName: "Regional Safety Data"
    });
  }
}

export function buildLiveSources(propertyId: string, property: Property) {
  return [
    {
      id: `source-${propertyId}`,
      propertyId,
      sourceName: property.sourceSummary,
      sourceListingId: property.id,
      sourceUrl: "#",
      rawPayload: {},
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      squareFeet: property.squareFeet,
      status: "active" as const,
      thumbnailUrl: property.images[0],
      lastSeenAt: new Date().toISOString()
    }
  ];
}

export function buildMockFallbackSources(propertyId: string) {
  return mockSourceRecords.filter((record) => record.propertyId === propertyId);
}
