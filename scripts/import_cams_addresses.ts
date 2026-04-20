import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildLocalAddressRecord,
  ensureLocalAddressDatasetDirs,
  getLocalAddressDatasetPaths,
  getLocalAddressShardKeys
} from "@/lib/local-addresses";

type ArcGisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: {
    x?: number;
    y?: number;
  };
};

const CAMS_LAYER_URL =
  process.env.CAMS_LAYER_URL?.trim() ||
  "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/402/query";
const CAMS_PAGE_SIZE = Number(process.env.CAMS_PAGE_SIZE ?? 2000);
const MAX_PAGES = Number(process.env.CAMS_MAX_PAGES ?? 0);

const fields = [
  "OBJECTID",
  "FullAddress",
  "LegalComm",
  "PostComm1",
  "PostComm2",
  "PostComm3",
  "ZipCode",
  "NumPrefix",
  "Number",
  "NumberSuffix",
  "NumSuffix",
  "PreDir",
  "StreetName",
  "PostType",
  "PostDir",
  "FullName"
] as const;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildStreetAddress(attributes: Record<string, unknown>) {
  const fullAddress = normalizeWhitespace(String(attributes.FullAddress ?? ""));
  if (fullAddress) return fullAddress;

  return normalizeWhitespace(
    [
      attributes.NumPrefix,
      attributes.Number,
      attributes.NumberSuffix,
      attributes.NumSuffix,
      attributes.PreDir,
      attributes.StreetName,
      attributes.PostType,
      attributes.PostDir
    ]
      .map((value) => String(value ?? ""))
      .filter(Boolean)
      .join(" ")
  );
}

function getCityAlternates(attributes: Record<string, unknown>) {
  return [attributes.PostComm1, attributes.PostComm2, attributes.PostComm3, attributes.LegalComm]
    .map((value) => normalizeWhitespace(String(value ?? "")))
    .filter(Boolean);
}

function buildQueryUrl(offset: number) {
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: fields.join(","),
    returnGeometry: "true",
    outSR: "4326",
    resultOffset: String(offset),
    resultRecordCount: String(CAMS_PAGE_SIZE),
    orderByFields: "OBJECTID ASC"
  });

  return `${CAMS_LAYER_URL}?${params.toString()}`;
}

async function appendShardRecords(tempDir: string, fileName: string, records: string[]) {
  if (!records.length) return;
  const filePath = path.join(tempDir, fileName);
  await writeFile(filePath, `${records.join("\n")}\n`, { encoding: "utf8", flag: "a" });
}

async function materializeShardDirectory(input: {
  sourceDir: string;
  targetDir: string;
}) {
  const files = (await readdir(input.sourceDir)).filter((file) => file.endsWith(".ndjson"));

  for (const file of files) {
    const raw = await readFile(path.join(input.sourceDir, file), "utf8");
    const deduped = new Map<string, string>();

    for (const line of raw.split("\n").filter(Boolean)) {
      const parsed = JSON.parse(line) as { id: string };
      deduped.set(parsed.id, line);
    }

    const records = Array.from(deduped.values()).map((line) => JSON.parse(line));
    records.sort((a, b) => String(a.canonicalAddress).localeCompare(String(b.canonicalAddress)));
    await writeFile(
      path.join(input.targetDir, file.replace(/\.ndjson$/, ".json")),
      JSON.stringify(records),
      "utf8"
    );
  }
}

async function main() {
  const datasetPaths = getLocalAddressDatasetPaths();
  const tempDir = path.join(datasetPaths.datasetDir, ".tmp");
  const tempSearchDir = path.join(tempDir, "search");
  const tempReverseDir = path.join(tempDir, "reverse");

  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempSearchDir, { recursive: true });
  await mkdir(tempReverseDir, { recursive: true });

  let page = 0;
  let offset = 0;
  let totalRecords = 0;
  let done = false;

  while (!done) {
    if (MAX_PAGES > 0 && page >= MAX_PAGES) {
      break;
    }

    const response = await fetch(buildQueryUrl(offset), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`CAMS import failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      features?: ArcGisFeature[];
      exceededTransferLimit?: boolean;
    };
    const features = payload.features ?? [];
    if (!features.length) {
      break;
    }

    const searchBuffers = new Map<string, string[]>();
    const reverseBuffers = new Map<string, string[]>();

    for (const feature of features) {
      const attributes = feature.attributes ?? {};
      const lat = Number(feature.geometry?.y);
      const lng = Number(feature.geometry?.x);
      const streetAddress = buildStreetAddress(attributes);
      const cityAlternates = getCityAlternates(attributes);
      const city = cityAlternates[0] ?? "Los Angeles";

      if (!streetAddress || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      const record = buildLocalAddressRecord({
        id: String(attributes.OBJECTID ?? `${lat},${lng},${streetAddress}`),
        streetAddress,
        city,
        cityAlternates,
        state: "CA",
        zipCode: String(attributes.ZipCode ?? "").trim(),
        lat,
        lng
      });
      const serialized = JSON.stringify(record);
      const { searchKey, reverseKey } = getLocalAddressShardKeys(record);

      searchBuffers.set(searchKey, [...(searchBuffers.get(searchKey) ?? []), serialized]);
      reverseBuffers.set(reverseKey, [...(reverseBuffers.get(reverseKey) ?? []), serialized]);
      totalRecords += 1;
    }

    await Promise.all([
      ...Array.from(searchBuffers.entries()).map(([key, records]) =>
        appendShardRecords(tempSearchDir, `${key}.ndjson`, records)
      ),
      ...Array.from(reverseBuffers.entries()).map(([key, records]) =>
        appendShardRecords(tempReverseDir, `${key}.ndjson`, records)
      )
    ]);

    page += 1;
    offset += features.length;
    done = !payload.exceededTransferLimit || features.length < CAMS_PAGE_SIZE;
    console.log(`Imported page ${page} (${features.length} records, total ${totalRecords})`);
  }

  await ensureLocalAddressDatasetDirs();
  await materializeShardDirectory({
    sourceDir: tempSearchDir,
    targetDir: datasetPaths.searchDir
  });
  await materializeShardDirectory({
    sourceDir: tempReverseDir,
    targetDir: datasetPaths.reverseDir
  });

  await writeFile(
    datasetPaths.manifestPath,
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: "LA County CAMS Address Points",
        sourceUrl: CAMS_LAYER_URL,
        totalRecords,
        searchShardPrefixLength: 2,
        reverseCellSize: 0.02
      },
      null,
      2
    ),
    "utf8"
  );

  await rm(tempDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRecords,
        datasetDir: datasetPaths.datasetDir,
        manifestPath: datasetPaths.manifestPath
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
