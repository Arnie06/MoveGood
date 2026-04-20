import { NextResponse } from "next/server";

import { getProviderMode } from "@/lib/env";
import { getLocalAddressDatasetPaths, hasLocalAddressDataset, readLocalAddressManifest } from "@/lib/local-addresses";

export async function GET() {
  const configuredMode = getProviderMode("geocoder");
  const localBaseUrl = process.env.LOCAL_GEOCODER_BASE_URL?.trim().replace(/\/+$/, "") || null;
  const localDatasetReady = hasLocalAddressDataset();
  const effectiveMode =
    configuredMode === "auto"
      ? localBaseUrl
        ? "local"
        : localDatasetReady
          ? "local"
        : process.env.GEOAPIFY_API_KEY?.trim()
          ? "live"
          : "mock"
      : configuredMode;

  if (effectiveMode !== "local") {
    return NextResponse.json({
      configuredMode,
      effectiveMode,
      localBaseUrl,
      localDatasetReady,
      reachable: false,
      reason:
        localBaseUrl || localDatasetReady
          ? "Local geocoder is not the active provider."
          : "Neither LOCAL_GEOCODER_BASE_URL nor a local dataset is available."
    });
  }

  if (localBaseUrl) {
    try {
      const params = new URLSearchParams({
        text: "Los Angeles",
        size: "1"
      });
      const response = await fetch(`${localBaseUrl}/v1/search?${params.toString()}`, {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      return NextResponse.json({
        configuredMode,
        effectiveMode,
        localBaseUrl,
        localDatasetReady,
        reachable: response.ok,
        status: response.status,
        reason: response.ok ? "Local Pelias-compatible geocoder responded successfully." : `Unexpected status ${response.status}.`
      });
    } catch (error) {
      return NextResponse.json({
        configuredMode,
        effectiveMode,
        localBaseUrl,
        localDatasetReady,
        reachable: false,
        reason: error instanceof Error ? error.message : "Local geocoder request failed."
      });
    }
  }

  const manifest = await readLocalAddressManifest();
  const datasetPaths = getLocalAddressDatasetPaths();

  return NextResponse.json({
    configuredMode,
    effectiveMode,
    localBaseUrl,
    localDatasetReady,
    reachable: localDatasetReady,
    reason: localDatasetReady
      ? "Local address dataset is available."
      : "Local address dataset manifest is missing.",
    datasetDir: datasetPaths.datasetDir,
    manifest
  });
}
