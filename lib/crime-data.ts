import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CrimeIncident, CrimeIncidentCategory, CrimeMetric } from "@/lib/types/domain";
import { clampScore } from "@/lib/utils";

const CRIME_DATA_DIR = path.join(process.cwd(), "data", "crime");

export const LOCAL_CRIME_INCIDENTS_PATH = path.join(CRIME_DATA_DIR, "local-incidents.json");
export const LAPD_CALLS_SNAPSHOT_PATH = path.join(
  CRIME_DATA_DIR,
  "lapd-calls-for-service.json"
);
export const LAPD_CALLS_METADATA_PATH = path.join(
  CRIME_DATA_DIR,
  "lapd-calls-for-service.metadata.json"
);

function parseNumber(value?: string) {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

export function categorizeCrimeLabel(label: string): CrimeIncidentCategory {
  const normalized = label.toLowerCase();

  if (
    normalized.includes("assault") ||
    normalized.includes("robbery") ||
    normalized.includes("homicide") ||
    normalized.includes("weapon") ||
    normalized.includes("shooting") ||
    normalized.includes("carjacking") ||
    normalized.includes("domestic violence")
  ) {
    return "violent";
  }

  if (
    normalized.includes("vehicle") ||
    normalized.includes("gta") ||
    normalized.includes("grand theft auto") ||
    normalized.includes("hit and run")
  ) {
    return "vehicle";
  }

  if (
    normalized.includes("burglary") ||
    normalized.includes("vandalism") ||
    normalized.includes("arson")
  ) {
    return "property";
  }

  if (
    normalized.includes("theft") ||
    normalized.includes("shoplifting") ||
    normalized.includes("larceny")
  ) {
    return "theft";
  }

  return "other";
}

export function normalizeLasdCrimeCsv(input: {
  content: string;
  sourceName: string;
  sourceFile: string;
}) {
  const rows = parseCsv(input.content);

  return rows.flatMap((row) => {
    const lat = parseNumber(row.LATITUDE);
    const lng = parseNumber(row.LONGITUDE);
    const occurredAt = parseDate(row.INCIDENT_DATE);
    if (lat == null || lng == null || !occurredAt) return [];

    const label = row.STAT_DESC?.trim() || row.CATEGORY?.trim() || "Reported crime";
    const city = row.CITY?.trim();
    const blockAddress = row.STREET?.trim() || row.ADDRESS?.trim() || undefined;

    return [
      {
        id: `lasd-${row.LURN_SAK || row.INCIDENT_ID || `${lat}:${lng}:${occurredAt.toISOString()}`}`,
        geoId: `${lat.toFixed(4)},${lng.toFixed(4)}`,
        lat,
        lng,
        category: categorizeCrimeLabel(label),
        label,
        blockAddress,
        occurredAt: occurredAt.toISOString(),
        sourceName: input.sourceName,
        metadata: {
          city,
          zip: row.ZIP?.trim() || undefined,
          unitName: row.UNIT_NAME?.trim() || undefined,
          partCategory: row.PART_CATEGORY?.trim() || undefined,
          incidentId: row.INCIDENT_ID?.trim() || undefined,
          sourceFile: path.basename(input.sourceFile)
        }
      } satisfies CrimeIncident
    ];
  });
}

export function mergeCrimeIncidents(incidentGroups: CrimeIncident[][]) {
  const deduped = new Map<string, CrimeIncident>();

  incidentGroups.flat().forEach((incident) => {
    deduped.set(incident.id, incident);
  });

  return Array.from(deduped.values()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function readPersistedCrimeIncidents() {
  try {
    const raw = await readFile(LOCAL_CRIME_INCIDENTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as CrimeIncident[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writePersistedCrimeIncidents(incidents: CrimeIncident[]) {
  await mkdir(CRIME_DATA_DIR, { recursive: true });
  await writeFile(LOCAL_CRIME_INCIDENTS_PATH, JSON.stringify(incidents, null, 2), "utf8");
}

export async function writeLapdCallsSnapshot(input: {
  payload: unknown;
  metadata: Record<string, unknown>;
}) {
  await mkdir(CRIME_DATA_DIR, { recursive: true });
  await writeFile(LAPD_CALLS_SNAPSHOT_PATH, JSON.stringify(input.payload, null, 2), "utf8");
  await writeFile(LAPD_CALLS_METADATA_PATH, JSON.stringify(input.metadata, null, 2), "utf8");
}

export function buildCrimeMetricsFromIncidents(input: {
  incidents: CrimeIncident[];
  lat: number;
  lng: number;
  radiusMiles: number;
  sourceName?: string;
}) {
  if (!input.incidents.length) return [];

  const violent = input.incidents.filter((incident) => incident.category === "violent").length;
  const property = input.incidents.filter(
    (incident) => incident.category === "property" || incident.category === "vehicle"
  ).length;
  const theft = input.incidents.filter((incident) => incident.category === "theft").length;
  const radiusWeight = Math.max(0.5, input.radiusMiles);
  const rawOverall =
    100 - violent * 7 - property * 3.5 - theft * 2.5 - input.incidents.length / (8 * radiusWeight);
  const overall = clampScore(rawOverall);
  const effectiveDate = new Date().toISOString();
  const geoId = `${input.lat.toFixed(4)},${input.lng.toFixed(4)}`;
  const sourceName = input.sourceName ?? "Local Crime Imports";

  return [
    {
      id: `${geoId}-overall`,
      geoId,
      lat: input.lat,
      lng: input.lng,
      radiusMiles: input.radiusMiles,
      metricType: "overall" as const,
      value: input.incidents.length,
      normalizedScore: overall,
      sourceName,
      comparisonLabel: "Approximate safety context from nearby reported incidents",
      effectiveDate
    },
    {
      id: `${geoId}-violent`,
      geoId,
      lat: input.lat,
      lng: input.lng,
      radiusMiles: input.radiusMiles,
      metricType: "violent" as const,
      value: violent,
      normalizedScore: clampScore(100 - violent * 10),
      sourceName,
      comparisonLabel: "Nearby violent incidents in recent reports",
      effectiveDate
    },
    {
      id: `${geoId}-property`,
      geoId,
      lat: input.lat,
      lng: input.lng,
      radiusMiles: input.radiusMiles,
      metricType: "property" as const,
      value: property,
      normalizedScore: clampScore(100 - property * 6),
      sourceName,
      comparisonLabel: "Nearby property-related incidents in recent reports",
      effectiveDate
    },
    {
      id: `${geoId}-theft`,
      geoId,
      lat: input.lat,
      lng: input.lng,
      radiusMiles: input.radiusMiles,
      metricType: "theft" as const,
      value: theft,
      normalizedScore: clampScore(100 - theft * 5),
      sourceName,
      comparisonLabel: "Nearby theft incidents in recent reports",
      effectiveDate
    }
  ] satisfies CrimeMetric[];
}
