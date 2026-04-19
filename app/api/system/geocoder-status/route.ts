import { NextResponse } from "next/server";

import { getProviderMode } from "@/lib/env";

export async function GET() {
  const configuredMode = getProviderMode("geocoder");
  const localBaseUrl = process.env.LOCAL_GEOCODER_BASE_URL?.trim().replace(/\/+$/, "") || null;
  const effectiveMode =
    configuredMode === "auto"
      ? localBaseUrl
        ? "local"
        : process.env.GEOAPIFY_API_KEY?.trim()
          ? "live"
          : "mock"
      : configuredMode;

  if (effectiveMode !== "local" || !localBaseUrl) {
    return NextResponse.json({
      configuredMode,
      effectiveMode,
      localBaseUrl,
      reachable: false,
      reason: localBaseUrl ? "Local geocoder is not the active provider." : "LOCAL_GEOCODER_BASE_URL is not set."
    });
  }

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
      reachable: response.ok,
      status: response.status,
      reason: response.ok ? "Local geocoder responded successfully." : `Unexpected status ${response.status}.`
    });
  } catch (error) {
    return NextResponse.json({
      configuredMode,
      effectiveMode,
      localBaseUrl,
      reachable: false,
      reason: error instanceof Error ? error.message : "Local geocoder request failed."
    });
  }
}
