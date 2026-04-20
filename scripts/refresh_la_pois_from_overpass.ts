import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type AmenityCategory =
  | "grocery"
  | "gym"
  | "park"
  | "restaurant"
  | "coffee"
  | "bar"
  | "transit"
  | "school"
  | "doctor"
  | "major-poi"
  | "custom";

type AmenityPOI = {
  id: string;
  name: string;
  category: AmenityCategory;
  lat: number;
  lng: number;
  address: string;
  metadata?: Record<string, unknown>;
};

type OverpassElement = {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

const OUTPUT_DIR = path.join(process.cwd(), "data", "pois");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "los-angeles.json");
const METADATA_PATH = path.join(OUTPUT_DIR, "los-angeles.metadata.json");
const OVERPASS_URL = process.env.OVERPASS_URL?.trim() || "https://overpass-api.de/api/interpreter";

// Los Angeles County bounds, slightly expanded to match the map cache region.
const COUNTY_BOUNDS = {
  south: 33.25,
  west: -119.2,
  north: 34.95,
  east: -117.4
} as const;

const categoryQueries: Record<AmenityCategory, string[]> = {
  grocery: [
    'node["shop"~"supermarket|grocery|convenience"]',
    'way["shop"~"supermarket|grocery|convenience"]'
  ],
  gym: [
    'node["leisure"="fitness_centre"]',
    'way["leisure"="fitness_centre"]',
    'node["sport"="fitness"]',
    'way["sport"="fitness"]'
  ],
  park: [
    'node["leisure"~"park|garden|nature_reserve|playground"]',
    'way["leisure"~"park|garden|nature_reserve|playground"]',
    'relation["leisure"~"park|garden|nature_reserve|playground"]',
    'node["boundary"="national_park"]',
    'way["boundary"="national_park"]',
    'relation["boundary"="national_park"]'
  ],
  restaurant: [
    'node["amenity"~"restaurant|fast_food|food_court"]',
    'way["amenity"~"restaurant|fast_food|food_court"]'
  ],
  coffee: ['node["amenity"="cafe"]', 'way["amenity"="cafe"]'],
  bar: ['node["amenity"~"bar|pub"]', 'way["amenity"~"bar|pub"]'],
  transit: [
    'node["public_transport"]',
    'way["public_transport"]',
    'node["railway"~"station|tram_stop|halt"]',
    'way["railway"~"station|tram_stop|halt"]',
    'node["amenity"="bus_station"]',
    'way["amenity"="bus_station"]'
  ],
  school: [
    'node["amenity"="school"]',
    'way["amenity"="school"]',
    'node["building"="school"]',
    'way["building"="school"]'
  ],
  doctor: [
    'node["amenity"~"hospital|doctors|clinic"]',
    'way["amenity"~"hospital|doctors|clinic"]'
  ],
  "major-poi": [
    'node["tourism"]',
    'way["tourism"]',
    'node["historic"]',
    'way["historic"]',
    'node["amenity"~"theatre|cinema|library|arts_centre|museum"]',
    'way["amenity"~"theatre|cinema|library|arts_centre|museum"]'
  ],
  custom: []
};

function getCoordinates(element: OverpassElement) {
  const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
  const lng = typeof element.lon === "number" ? element.lon : element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat as number, lng: lng as number };
}

function buildAddress(tags: Record<string, string>) {
  const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
  if (address) return address;

  return tags.name || tags.brand || "Address unavailable";
}

function toAmenity(category: AmenityCategory, element: OverpassElement): AmenityPOI | null {
  const coordinates = getCoordinates(element);
  if (!coordinates) return null;

  const tags = element.tags ?? {};
  const name = tags.name || tags.brand || `${category} nearby`;

  return {
    id: `${element.type ?? "item"}-${element.id ?? `${coordinates.lat},${coordinates.lng}`}`,
    name,
    category,
    lat: coordinates.lat,
    lng: coordinates.lng,
    address: buildAddress(tags),
    metadata: {
      osmType: element.type,
      osmId: element.id,
      ...tags
    }
  };
}

function dedupeAmenities(amenities: AmenityPOI[]) {
  const deduped = new Map<string, AmenityPOI>();

  for (const amenity of amenities) {
    const key = [
      amenity.category,
      amenity.name,
      amenity.lat.toFixed(5),
      amenity.lng.toFixed(5)
    ].join(":");
    deduped.set(key, amenity);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

function buildQuery(category: AmenityCategory) {
  const bbox = `(${COUNTY_BOUNDS.south},${COUNTY_BOUNDS.west},${COUNTY_BOUNDS.north},${COUNTY_BOUNDS.east})`;
  const clauses = categoryQueries[category].map((clause) => `${clause}${bbox};`).join("");
  return `[out:json][timeout:180];(${clauses});out center;`;
}

async function fetchCategory(category: AmenityCategory) {
  if (categoryQueries[category].length === 0) return [] as AmenityPOI[];

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/plain"
    },
    body: buildQuery(category)
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed for ${category}: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  return (payload.elements ?? [])
    .map((element) => toAmenity(category, element))
    .filter((element): element is AmenityPOI => element !== null);
}

async function main() {
  const categories = Object.keys(categoryQueries) as AmenityCategory[];
  const groups: AmenityPOI[][] = [];

  for (const category of categories) {
    const amenities = await fetchCategory(category);
    groups.push(amenities);
    console.log(`Fetched ${amenities.length} ${category} POIs`);
  }

  const merged = dedupeAmenities(groups.flat());
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(merged), "utf8");
  await writeFile(
    METADATA_PATH,
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        source: "OpenStreetMap Overpass",
        sourceUrl: OVERPASS_URL,
        outputPath: OUTPUT_PATH,
        count: merged.length,
        categories
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        outputPath: OUTPUT_PATH,
        metadataPath: METADATA_PATH,
        count: merged.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
