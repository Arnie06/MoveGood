import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

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
const execFileAsync = promisify(execFile);

const COUNTY_BOUNDS = {
  south: 33.25,
  west: -119.2,
  north: 34.95,
  east: -117.4
} as const;

const parkQueries = [
  'node["leisure"~"park|garden|nature_reserve|playground"]',
  'way["leisure"~"park|garden|nature_reserve|playground"]',
  'relation["leisure"~"park|garden|nature_reserve|playground"]',
  'node["boundary"="national_park"]',
  'way["boundary"="national_park"]',
  'relation["boundary"="national_park"]'
];

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

function toParkAmenity(element: OverpassElement): AmenityPOI | null {
  const coordinates = getCoordinates(element);
  if (!coordinates) return null;

  const tags = element.tags ?? {};
  const name = tags.name || tags.brand;
  if (!name) return null;

  return {
    id: `${element.type ?? "item"}-${element.id ?? `${coordinates.lat},${coordinates.lng}`}`,
    name,
    category: "park",
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

function buildParkQuery() {
  const bbox = `(${COUNTY_BOUNDS.south},${COUNTY_BOUNDS.west},${COUNTY_BOUNDS.north},${COUNTY_BOUNDS.east})`;
  const clauses = parkQueries.map((clause) => `${clause}${bbox};`).join("");
  return `[out:json][timeout:180];(${clauses});out center;`;
}

async function fetchCountyParks() {
  const { stdout } = await execFileAsync("curl", [
    "-s",
    "-X",
    "POST",
    "-H",
    "Content-Type: text/plain",
    "--data",
    buildParkQuery(),
    OVERPASS_URL
  ], {
    maxBuffer: 24 * 1024 * 1024
  });
  const payload = JSON.parse(stdout) as {
    elements?: OverpassElement[];
    remark?: string;
  };

  if (payload.remark) {
    throw new Error(`Overpass request failed for parks: ${payload.remark}`);
  }

  return (payload.elements ?? [])
    .map((element) => toParkAmenity(element))
    .filter((element): element is AmenityPOI => element !== null);
}

async function readExistingAmenities() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AmenityPOI[]) : [];
  } catch {
    return [];
  }
}

async function main() {
  const [existingAmenities, freshParks] = await Promise.all([
    readExistingAmenities(),
    fetchCountyParks()
  ]);

  const merged = dedupeAmenities([
    ...existingAmenities.filter((amenity) => amenity.category !== "park"),
    ...freshParks
  ]);
  const parkCount = merged.filter((amenity) => amenity.category === "park").length;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(merged), "utf8");
  await writeFile(
    METADATA_PATH,
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        source: "Geoapify cached export with Overpass park refresh",
        sourceUrl: OVERPASS_URL,
        outputPath: OUTPUT_PATH,
        count: merged.length,
        parkCount
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        outputPath: OUTPUT_PATH,
        metadataPath: METADATA_PATH,
        count: merged.length,
        parkCount
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
