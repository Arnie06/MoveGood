import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserPreferences } from "@/lib/types/domain";
import { SavedPlace, AmenityPOI } from "@/lib/types/domain";

const mockGeocode = vi.fn();
const mockReverseGeocode = vi.fn();
const mockAutocomplete = vi.fn();
const mockGetNearbyAmenities = vi.fn();
const mockGetSafetyMetrics = vi.fn();
const mockGetCrimeIncidents = vi.fn();
const mockGetRouteMetrics = vi.fn();

vi.mock("@/lib/geocode-cache", () => ({
  readCachedAutocomplete: vi.fn().mockResolvedValue(null),
  readCachedGeocode: vi.fn().mockResolvedValue(null),
  readCachedReverseGeocode: vi.fn().mockResolvedValue(null),
  writeCachedAutocomplete: vi.fn().mockResolvedValue(undefined),
  writeCachedGeocode: vi.fn().mockResolvedValue(undefined),
  writeCachedReverseGeocode: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/lib/los-angeles-pois", () => ({
  isWithinLosAngelesBounds: vi.fn().mockReturnValue(false),
  getLosAngelesAmenitiesInBounds: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/providers/registry", () => ({
  getGeocoderProvider: () => ({
    name: "test-geocoder",
    geocode: mockGeocode,
    reverseGeocode: mockReverseGeocode,
    autocomplete: mockAutocomplete
  }),
  getPoiProvider: () => ({
    name: "test-poi",
    getNearbyAmenities: mockGetNearbyAmenities
  }),
  getSafetyProvider: () => ({
    name: "test-safety",
    getSafetyMetrics: mockGetSafetyMetrics,
    getCrimeIncidents: mockGetCrimeIncidents
  }),
  getRoutingProvider: () => ({
    name: "test-routing",
    getRouteMetrics: mockGetRouteMetrics
  }),
  buildMockFallbackSources: vi.fn(() => [])
}));

vi.mock("@/lib/providers/live", () => ({
  buildLiveSources: vi.fn(() => [])
}));

vi.mock("@/lib/providers/mock", () => ({
  MockSafetyProvider: class MockSafetyProvider {
    async getCrimeIncidents() {
      return [];
    }

    async getSafetyMetrics() {
      return [];
    }
  }
}));

describe("analyzeLocation", () => {
  const previousLocalOnly = process.env.LOCAL_ONLY_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOCAL_ONLY_MODE = previousLocalOnly;
  });

  it("builds a full analysis result for typed address inputs", async () => {
    const now = "2026-04-20T00:00:00.000Z";
    mockGeocode.mockResolvedValue({
      canonicalAddress: "123 Main St, New York, NY 10001",
      lat: 40.75,
      lng: -73.99,
      city: "New York",
      state: "NY",
      zipCode: "10001"
    });
    mockAutocomplete.mockResolvedValue([]);
    mockGetNearbyAmenities.mockResolvedValue([
      { id: "g1", name: "Market", category: "grocery", lat: 40.751, lng: -73.988, address: "x" },
      { id: "p1", name: "Park", category: "park", lat: 40.752, lng: -73.987, address: "x" }
    ]);
    mockGetCrimeIncidents.mockResolvedValue([
      {
        id: "incident-1",
        geoId: "geo-1",
        lat: 40.75,
        lng: -73.99,
        category: "property",
        label: "Property incident",
        occurredAt: now,
        sourceName: "test"
      }
    ]);
    mockGetSafetyMetrics.mockResolvedValue([
      {
        id: "metric-1",
        geoId: "geo-1",
        lat: 40.75,
        lng: -73.99,
        metricType: "overall",
        value: 0,
        normalizedScore: 78,
        sourceName: "test",
        effectiveDate: now
      }
    ]);
    mockGetRouteMetrics.mockImplementation(async (input) =>
      input.destinations.map((destination: SavedPlace | AmenityPOI, index: number) => ({
        id: `live-route-${index}`,
        propertyId: input.propertyId,
        destinationType:
          "includeInScoring" in destination ? "saved-place" : destination.category,
        destinationId: destination.id,
        destinationLabel: "label" in destination ? destination.label : destination.name,
        walkingMinutes: 8 + index,
        driveMinutesOffPeak: 5 + index,
        driveMinutesPeak: 7 + index,
        sourceName: "test-route-live",
        updatedAt: now
      }))
    );

    const preferences: UserPreferences = {
      id: "user-1",
      scoringWeights: {
        safety: 30,
        accessibility: 20,
        walk: 20,
        drive: 15,
        affordability: 0,
        homeFit: 0,
        lifestyle: 15
      },
      hardRules: [],
      savedPlaces: [
        {
          id: "work",
          label: "Work",
          category: "work",
          address: "Office",
          lat: 40.73,
          lng: -73.98,
          includeInScoring: true
        }
      ]
    };

    const { analyzeLocation } = await import("@/lib/demo-service");
    const result = await analyzeLocation({
      address: "123 Main St, New York, NY",
      preferences
    });

    expect(result).not.toBeNull();
    expect(result?.property.canonicalAddress).toContain("123 Main St");
    expect(result?.nearbyAmenities.map((amenity) => amenity.category).sort()).toEqual(["grocery", "park"]);
    expect(result?.routeMetrics.length).toBe(3);
    expect(result?.routeMetrics.every((route) => route.sourceName === "test-route-live")).toBe(true);
    expect(
      result?.routeMetrics.every(
        (route) =>
          (route.walkingMinutes ?? 0) >= 4 &&
          (route.driveMinutesPeak ?? 0) >= (route.driveMinutesOffPeak ?? 0)
      )
    ).toBe(true);
    expect(result?.score.overallScore).toBeGreaterThan(0);
    expect(result?.score.dataCompleteness).toEqual([]);
  });

  it("falls back to reverse geocode when address lookup fails", async () => {
    mockGeocode.mockResolvedValue(null);
    mockAutocomplete.mockResolvedValue([]);
    mockReverseGeocode.mockResolvedValue({
      canonicalAddress: "Dropped Pin",
      lat: 40.7,
      lng: -73.95,
      city: "New York",
      state: "NY",
      zipCode: "10002"
    });
    mockGetNearbyAmenities.mockResolvedValue([]);
    mockGetCrimeIncidents.mockResolvedValue([]);
    mockGetSafetyMetrics.mockResolvedValue([]);
    mockGetRouteMetrics.mockRejectedValue(new Error("Routing unavailable"));

    const { analyzeLocation } = await import("@/lib/demo-service");
    const result = await analyzeLocation({
      address: "Unresolvable",
      lat: 40.7,
      lng: -73.95
    });

    expect(result).not.toBeNull();
    expect(mockReverseGeocode).toHaveBeenCalledWith({ lat: 40.7, lng: -73.95 });
  });

  it("keeps POI and route calculations populated in local-only mode with estimated amenities", async () => {
    process.env.LOCAL_ONLY_MODE = "true";
    mockReverseGeocode.mockResolvedValue({
      canonicalAddress: "Dropped Pin",
      lat: 36.17,
      lng: -115.14,
      city: "Las Vegas",
      state: "NV",
      zipCode: "89101"
    });
    mockGetNearbyAmenities.mockResolvedValue([]);
    mockGetCrimeIncidents.mockResolvedValue([]);
    mockGetSafetyMetrics.mockResolvedValue([]);
    mockGetRouteMetrics.mockRejectedValue(new Error("Routing unavailable"));

    const { analyzeLocation } = await import("@/lib/demo-service");
    const result = await analyzeLocation({
      lat: 36.17,
      lng: -115.14
    });

    expect(result).not.toBeNull();
    expect(result?.nearbyAmenities.length).toBeGreaterThanOrEqual(6);
    expect(result?.routeMetrics.length).toBeGreaterThanOrEqual(6);
    expect(result?.routeMetrics.every((route) => route.walkingMinutes != null)).toBe(true);
    expect(result?.score.dataCompleteness).not.toContain(
      "Travel-time data is limited, so commute scoring is conservative"
    );
  });
});
