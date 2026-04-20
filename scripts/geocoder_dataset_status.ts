import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const DATASET_DIR = path.join(process.cwd(), "data", "addresses", "la-addresses");
const MANIFEST_PATH = path.join(DATASET_DIR, "manifest.json");
const SEARCH_DIR = path.join(DATASET_DIR, "search");
const REVERSE_DIR = path.join(DATASET_DIR, "reverse");

type Manifest = {
  version: number;
  generatedAt: string;
  source: string;
  sourceUrl?: string;
  totalRecords: number;
  searchShardPrefixLength: number;
  reverseCellSize: number;
};

async function safeReadDir(dirPath: string) {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

async function safeStat(targetPath: string) {
  try {
    return await stat(targetPath);
  } catch {
    return null;
  }
}

async function getDirectorySize(root: string): Promise<number> {
  const entries = await safeReadDir(root);
  let total = 0;

  for (const entry of entries) {
    const entryPath = path.join(root, entry);
    const info = await safeStat(entryPath);
    if (!info) continue;

    if (info.isDirectory()) {
      total += await getDirectorySize(entryPath);
    } else {
      total += info.size;
    }
  }

  return total;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

async function readManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

async function main() {
  const manifest = await readManifest();
  const datasetStats = await safeStat(DATASET_DIR);
  const searchFiles = (await safeReadDir(SEARCH_DIR)).filter((file) => file.endsWith(".json"));
  const reverseFiles = (await safeReadDir(REVERSE_DIR)).filter((file) => file.endsWith(".json"));
  const sizeBytes = datasetStats?.isDirectory() ? await getDirectorySize(DATASET_DIR) : 0;

  const status =
    !datasetStats
      ? "missing"
      : !manifest
        ? "incomplete"
        : manifest.totalRecords <= 2000 && sizeBytes > 50 * 1024 * 1024
          ? "likely-incomplete"
          : "ready";

  console.log(
    JSON.stringify(
      {
        status,
        datasetDir: DATASET_DIR,
        manifestPath: MANIFEST_PATH,
        manifest,
        searchShardCount: searchFiles.length,
        reverseShardCount: reverseFiles.length,
        sizeBytes,
        sizeHuman: formatBytes(sizeBytes),
        note:
          status === "ready"
            ? "Manifest and shard directories look complete."
            : status === "likely-incomplete"
              ? "Dataset directory is large, but the manifest still looks like a partial smoke test."
              : status === "incomplete"
                ? "Dataset directory exists but manifest is missing or unreadable."
                : "Dataset directory has not been created yet."
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
