import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

const SOURCE_DIR = path.join(
  process.cwd(),
  ".runtime",
  "api-cache",
  "geoapify-los-angeles"
);
const OUTPUT_DIR = path.join(process.cwd(), "data", "pois");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "los-angeles.json");
const METADATA_PATH = path.join(OUTPUT_DIR, "los-angeles.metadata.json");

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

function dedupeAmenities(amenities: AmenityPOI[]) {
  const deduped = new Map<string, AmenityPOI>();

  for (const amenity of amenities) {
    const key = [
      amenity.id,
      amenity.category,
      amenity.lat.toFixed(5),
      amenity.lng.toFixed(5),
      amenity.name
    ].join(":");
    deduped.set(key, amenity);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }

    if (a.name !== b.name) {
      return a.name.localeCompare(b.name);
    }

    return a.id.localeCompare(b.id);
  });
}

async function main() {
  const files = (await readdir(SOURCE_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const groups: AmenityPOI[][] = [];

  for (const file of files) {
    const raw = await readFile(path.join(SOURCE_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as { data?: unknown };
    const items = Array.isArray(parsed.data) ? parsed.data.filter(isAmenityPoi) : [];
    groups.push(items);
  }

  const merged = dedupeAmenities(groups.flat());
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(merged), "utf8");
  await writeFile(
    METADATA_PATH,
    JSON.stringify(
      {
        refreshedAt: new Date().toISOString(),
        source: "Geoapify cached export",
        sourceDir: SOURCE_DIR,
        outputPath: OUTPUT_PATH,
        count: merged.length
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Wrote ${merged.length} POIs to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
