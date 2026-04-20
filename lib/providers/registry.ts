import { getAppMode, getProviderMode } from "@/lib/env";
import { GeocoderProvider, PoiProvider, RoutingProvider, SafetyProvider } from "@/lib/providers/interfaces";
import {
  buildMockFallbackSources,
  GeoapifyGeocoderProvider,
  GeoapifyPoiProvider,
  GeoapifyRoutingProvider,
  LAPDSafetyProvider,
  LocalPeliasGeocoderProvider
} from "@/lib/providers/live";
import { hasLocalAddressDataset } from "@/lib/local-addresses";
import { LocalDatasetGeocoderProvider } from "@/lib/providers/local";
import { MockGeocoderProvider, MockPoiProvider, MockRoutingProvider, MockSafetyProvider } from "@/lib/providers/mock";

function chooseProvider<T>(mode: string, live: T, mock: T): T {
  if (mode === "live") return live;
  if (mode === "mock") return mock;
  return getAppMode() === "demo" ? mock : live;
}

export function getGeocoderProvider(): GeocoderProvider {
  const mode = getProviderMode("geocoder");
  const localBaseUrl = process.env.LOCAL_GEOCODER_BASE_URL?.trim();
  const hasLocalDataset = hasLocalAddressDataset();
  if (mode === "local") {
    if (localBaseUrl) return new LocalPeliasGeocoderProvider();
    if (hasLocalDataset) return new LocalDatasetGeocoderProvider();
    return new MockGeocoderProvider();
  }

  if (mode === "auto" && localBaseUrl) {
    return new LocalPeliasGeocoderProvider();
  }

  if (mode === "auto" && hasLocalDataset) {
    return new LocalDatasetGeocoderProvider();
  }

  const live: GeocoderProvider = new GeoapifyGeocoderProvider();
  if (mode === "auto" && !process.env.GEOAPIFY_API_KEY) {
    return new MockGeocoderProvider();
  }
  return chooseProvider(mode, live, new MockGeocoderProvider());
}

export function getPoiProvider(): PoiProvider {
  const live: PoiProvider = new GeoapifyPoiProvider();
  if (getProviderMode("poi") === "auto" && !process.env.GEOAPIFY_API_KEY) {
    return new MockPoiProvider();
  }
  return chooseProvider(getProviderMode("poi"), live, new MockPoiProvider());
}

export function getRoutingProvider(): RoutingProvider {
  const live: RoutingProvider = new GeoapifyRoutingProvider();
  if (getProviderMode("routing") === "auto" && !process.env.GEOAPIFY_API_KEY) {
    return new MockRoutingProvider();
  }
  return chooseProvider(getProviderMode("routing"), live, new MockRoutingProvider());
}

export function getSafetyProvider(): SafetyProvider {
  const live: SafetyProvider = new LAPDSafetyProvider();
  return chooseProvider(getProviderMode("safety"), live, new MockSafetyProvider());
}

export { buildMockFallbackSources };
