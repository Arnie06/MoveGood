import { getApiCacheTtlMs, readApiCache, writeApiCache } from "@/lib/api-cache";
import { consumeGeoapifyBudget } from "@/lib/geoapify-budget";
import { AmenityCategory, AmenityPOI } from "@/lib/types/domain";

const LOS_ANGELES_POI_CACHE_TTL_MS = getApiCacheTtlMs(
  Number(process.env.LOS_ANGELES_POI_CACHE_TTL_MS ?? 72 * 60 * 60 * 1000)
);
const GEOAPIFY_PAGE_LIMIT = 20;

// County-scale cache bounds for Los Angeles County, including Catalina and the northern desert area.
// This is intentionally a little broader than the county outline so we can fully hydrate the county
// without relying on live POI fallback during viewport browsing.
export const LOS_ANGELES_COUNTY_CACHE_BOUNDS = {
  west: -119.20,
  south: 33.25,
  east: -117.40,
  north: 34.95
} as const;

const losAngelesCategoryMap: Record<AmenityCategory, string[]> = {
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

type GeoapifyFeature = {
  properties?: Record<string, unknown>;
};

function buildCategoryKey(category: AmenityCategory) {
  return `los-angeles:${category}`;
}

function getRectFilter() {
  return `rect:${LOS_ANGELES_COUNTY_CACHE_BOUNDS.west},${LOS_ANGELES_COUNTY_CACHE_BOUNDS.south},${LOS_ANGELES_COUNTY_CACHE_BOUNDS.east},${LOS_ANGELES_COUNTY_CACHE_BOUNDS.north}`;
}

function normalizeCategory(category: AmenityCategory, rawCategories: string[]) {
  return (
    (Object.entries(losAngelesCategoryMap).find(([, values]) =>
      rawCategories.some((entry) => values.some((value) => entry.startsWith(value)))
    )?.[0] as AmenityCategory | undefined) ?? category
  );
}

function toAmenity(feature: GeoapifyFeature, fallbackCategory: AmenityCategory, index: number) {
  const properties = feature.properties ?? {};
  const rawCategories = Array.isArray(properties.categories)
    ? properties.categories.map(String)
    : [];
  const category = normalizeCategory(fallbackCategory, rawCategories);

  return {
    id: String(properties.place_id ?? `${category}-${index}`),
    name: String(properties.name ?? properties.address_line1 ?? "Nearby place"),
    category,
    lat: Number(properties.lat ?? 0),
    lng: Number(properties.lon ?? 0),
    address: String(properties.formatted ?? properties.address_line2 ?? "Address unavailable"),
    metadata: properties
  } satisfies AmenityPOI;
}

function isValidAmenity(amenity: AmenityPOI) {
  return (
    Number.isFinite(amenity.lat) &&
    Number.isFinite(amenity.lng) &&
    amenity.lat >= LOS_ANGELES_COUNTY_CACHE_BOUNDS.south &&
    amenity.lat <= LOS_ANGELES_COUNTY_CACHE_BOUNDS.north &&
    amenity.lng >= LOS_ANGELES_COUNTY_CACHE_BOUNDS.west &&
    amenity.lng <= LOS_ANGELES_COUNTY_CACHE_BOUNDS.east
  );
}

function dedupeAmenities(amenities: AmenityPOI[]) {
  const deduped = new Map<string, AmenityPOI>();

  amenities.forEach((amenity) => {
    const key = [
      amenity.id,
      amenity.category,
      amenity.lat.toFixed(5),
      amenity.lng.toFixed(5),
      amenity.name
    ].join(":");
    deduped.set(key, amenity);
  });

  return Array.from(deduped.values());
}

async function fetchGeoapifyPage(
  url: string,
  credits: number
): Promise<GeoapifyFeature[]> {
  await consumeGeoapifyBudget({
    kind: "places-los-angeles",
    target: url,
    credits
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: { revalidate: Math.round(LOS_ANGELES_POI_CACHE_TTL_MS / 1000) }
  });

  if (!response.ok) {
    throw new Error(`Geoapify Places request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { features?: GeoapifyFeature[] };
  return payload.features ?? [];
}

async function fetchLosAngelesCategoryAmenities(
  category: AmenityCategory,
  apiKey: string
) {
  const cached = await readApiCache<AmenityPOI[]>({
    namespace: "geoapify-los-angeles",
    keyParts: [buildCategoryKey(category)],
    ttlMs: LOS_ANGELES_POI_CACHE_TTL_MS
  });
  if (cached !== null) {
    return cached;
  }

  const categories = losAngelesCategoryMap[category];
  const results: AmenityPOI[] = [];
  let offset = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        categories: categories.join(","),
        filter: getRectFilter(),
        limit: String(GEOAPIFY_PAGE_LIMIT),
        offset: String(offset),
        apiKey
      });
      const url = `https://api.geoapify.com/v2/places?${params.toString()}`;
      const credits = Math.max(1, Math.ceil(GEOAPIFY_PAGE_LIMIT / 20));
      const features = await fetchGeoapifyPage(url, credits);

      results.push(
        ...features
          .map((feature, index) => toAmenity(feature, category, offset + index))
          .filter(isValidAmenity)
      );

      if (features.length < GEOAPIFY_PAGE_LIMIT) {
        break;
      }

      offset += GEOAPIFY_PAGE_LIMIT;
    }
  } catch (error) {
    console.warn(`Failed to hydrate Los Angeles POIs for ${category}`, error);
  }

  const deduped = dedupeAmenities(results);
  await writeApiCache({
    namespace: "geoapify-los-angeles",
    keyParts: [buildCategoryKey(category)],
    data: deduped
  });
  return deduped;
}

export function isWithinLosAngelesBounds(lat: number, lng: number) {
  return (
    lat >= LOS_ANGELES_COUNTY_CACHE_BOUNDS.south &&
    lat <= LOS_ANGELES_COUNTY_CACHE_BOUNDS.north &&
    lng >= LOS_ANGELES_COUNTY_CACHE_BOUNDS.west &&
    lng <= LOS_ANGELES_COUNTY_CACHE_BOUNDS.east
  );
}

export function intersectsLosAngelesBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  return !(
    bounds.east < LOS_ANGELES_COUNTY_CACHE_BOUNDS.west ||
    bounds.west > LOS_ANGELES_COUNTY_CACHE_BOUNDS.east ||
    bounds.north < LOS_ANGELES_COUNTY_CACHE_BOUNDS.south ||
    bounds.south > LOS_ANGELES_COUNTY_CACHE_BOUNDS.north
  );
}

export async function getLosAngelesAmenities(
  categories: AmenityCategory[] = ["grocery", "gym", "park", "restaurant", "coffee", "bar"]
) {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return [];

  const uniqueCategories = Array.from(new Set(categories));
  const groups = await Promise.all(
    uniqueCategories.map((category) => fetchLosAngelesCategoryAmenities(category, apiKey))
  );
  return dedupeAmenities(groups.flat());
}

export async function getLosAngelesAmenitiesInBounds(input: {
  west: number;
  south: number;
  east: number;
  north: number;
  categories?: AmenityCategory[];
}) {
  if (!intersectsLosAngelesBounds(input)) {
    return [];
  }

  const amenities = await getLosAngelesAmenities(input.categories);
  return amenities.filter(
    (amenity) =>
      amenity.lng >= input.west &&
      amenity.lng <= input.east &&
      amenity.lat >= input.south &&
      amenity.lat <= input.north
  );
}
