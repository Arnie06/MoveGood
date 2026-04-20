import { readFile } from "node:fs/promises";
import path from "node:path";

type AmenityCategory =
  | "grocery"
  | "gym"
  | "park"
  | "restaurant"
  | "coffee"
  | "bar";

type AmenityPOI = {
  id: string;
  category: string;
  lat: number;
  lng: number;
};

const REQUIRED_CATEGORIES: AmenityCategory[] = [
  "grocery",
  "gym",
  "park",
  "restaurant",
  "coffee",
  "bar"
];

function parseStrictFlag(argv: string[]) {
  return argv.includes("--strict");
}

function isAmenityRecord(value: unknown): value is AmenityPOI {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AmenityPOI>;
  return (
    typeof record.id === "string" &&
    typeof record.category === "string" &&
    typeof record.lat === "number" &&
    Number.isFinite(record.lat) &&
    typeof record.lng === "number" &&
    Number.isFinite(record.lng)
  );
}

async function main() {
  const strict = parseStrictFlag(process.argv.slice(2));
  const poiPath = path.join(process.cwd(), "data", "pois", "los-angeles.json");

  const raw = await readFile(poiPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const records = Array.isArray(parsed) ? parsed.filter(isAmenityRecord) : [];

  const counts = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.category] = (accumulator[record.category] ?? 0) + 1;
    return accumulator;
  }, {});

  const missingCategories = REQUIRED_CATEGORIES.filter(
    (category) => (counts[category] ?? 0) === 0
  );

  console.log("POI category counts:");
  for (const category of REQUIRED_CATEGORIES) {
    console.log(`- ${category}: ${counts[category] ?? 0}`);
  }

  if (missingCategories.length === 0) {
    console.log("Data quality check passed: all core categories are present.");
    return;
  }

  console.warn(
    `Data quality warning: missing categories in local POI dataset: ${missingCategories.join(", ")}`
  );
  console.warn(
    "Tip: refresh county cache and export POIs before enabling strict CI enforcement."
  );

  if (strict) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("verify_data_quality failed", error);
  process.exitCode = 1;
});
