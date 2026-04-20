import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

import { getLocalAddressDatasetPaths, hasLocalAddressDataset } from "@/lib/local-addresses";

const ARCHIVE_PATH = path.join("/tmp", "la-addresses.tar.gz");
const EXTRACT_PARENT_DIR = path.join(process.cwd(), "data", "addresses");
const TEMP_EXTRACT_DIR = path.join("/tmp", "la-addresses-extract");

function shouldRequireDataset() {
  const provider = process.env.GEOCODER_PROVIDER?.trim().toLowerCase();
  return provider === "local" && !process.env.LOCAL_GEOCODER_BASE_URL?.trim();
}

async function fileExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runTar(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("tar", args, {
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code ?? -1}`));
      }
    });
  });
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function downloadArchive(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "*/*"
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download address dataset: ${response.status} ${response.statusText}`);
  }

  const body = Readable.fromWeb(response.body as any);
  await pipeline(body, createWriteStream(ARCHIVE_PATH));
}

export async function bootstrapAddressDataset() {
  if (hasLocalAddressDataset()) {
    return { status: "ready" as const, source: "local" as const };
  }

  const datasetUrl = process.env.ADDRESS_DATASET_URL?.trim();
  if (!datasetUrl) {
    if (shouldRequireDataset()) {
      throw new Error(
        "GEOCODER_PROVIDER=local requires either a local address dataset, LOCAL_GEOCODER_BASE_URL, or ADDRESS_DATASET_URL."
      );
    }

    return { status: "skipped" as const, source: "none" as const };
  }

  const checksum = process.env.ADDRESS_DATASET_SHA256?.trim().toLowerCase();
  const datasetPaths = getLocalAddressDatasetPaths();

  await mkdir(EXTRACT_PARENT_DIR, { recursive: true });
  await rm(ARCHIVE_PATH, { force: true });
  await rm(TEMP_EXTRACT_DIR, { recursive: true, force: true });
  await mkdir(TEMP_EXTRACT_DIR, { recursive: true });

  console.log(`Downloading address dataset from ${datasetUrl}`);
  await downloadArchive(datasetUrl);

  if (checksum) {
    const actual = await sha256File(ARCHIVE_PATH);
    if (actual !== checksum) {
      throw new Error(
        `Address dataset checksum mismatch. Expected ${checksum}, received ${actual}.`
      );
    }
  }

  console.log("Extracting address dataset archive");
  await runTar(["-xzf", ARCHIVE_PATH, "-C", TEMP_EXTRACT_DIR]);

  const extractedDir = path.join(TEMP_EXTRACT_DIR, "la-addresses");
  if (!(await fileExists(path.join(extractedDir, "manifest.json")))) {
    throw new Error("Extracted address dataset is missing manifest.json");
  }

  await rm(datasetPaths.datasetDir, { recursive: true, force: true });
  await rename(extractedDir, datasetPaths.datasetDir);
  await rm(ARCHIVE_PATH, { force: true });
  await rm(TEMP_EXTRACT_DIR, { recursive: true, force: true });

  return { status: "downloaded" as const, source: datasetUrl };
}
