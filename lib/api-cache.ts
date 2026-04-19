import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_CACHE_TTL_MS = Number(
  process.env.API_CACHE_TTL_MS ?? 72 * 60 * 60 * 1000
);
const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const CACHE_DIR = path.join(RUNTIME_DIR, "api-cache");

type CacheRecord<T> = {
  cachedAt: string;
  data: T;
};

function resolveTtlMs(ttlMs?: number) {
  if (typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0) {
    return ttlMs;
  }

  return DEFAULT_API_CACHE_TTL_MS;
}

function buildCacheKey(parts: Array<string | number | undefined>) {
  return createHash("sha1")
    .update(parts.filter((part) => part != null).join("::"))
    .digest("hex");
}

function buildCachePath(namespace: string, key: string) {
  return path.join(CACHE_DIR, namespace, `${key}.json`);
}

async function ensureCacheDir(namespace: string) {
  await mkdir(path.join(CACHE_DIR, namespace), { recursive: true });
}

export function getApiCacheTtlMs(ttlMs?: number) {
  return resolveTtlMs(ttlMs);
}

export async function readApiCache<T>(input: {
  namespace: string;
  keyParts: Array<string | number | undefined>;
  ttlMs?: number;
}): Promise<T | null> {
  const key = buildCacheKey(input.keyParts);

  try {
    const raw = await readFile(buildCachePath(input.namespace, key), "utf8");
    const parsed = JSON.parse(raw) as CacheRecord<T>;
    const cachedAt = new Date(parsed.cachedAt);
    if (Number.isNaN(cachedAt.getTime())) return null;
    if (Date.now() - cachedAt.getTime() > resolveTtlMs(input.ttlMs)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function writeApiCache<T>(input: {
  namespace: string;
  keyParts: Array<string | number | undefined>;
  data: T;
}) {
  const key = buildCacheKey(input.keyParts);
  await ensureCacheDir(input.namespace);
  const payload: CacheRecord<T> = {
    cachedAt: new Date().toISOString(),
    data: input.data
  };
  await writeFile(
    buildCachePath(input.namespace, key),
    JSON.stringify(payload),
    "utf8"
  );
}
