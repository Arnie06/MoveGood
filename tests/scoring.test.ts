import { describe, expect, it } from "vitest";

import { defaultPreferences } from "@/lib/constants";
import { computePropertyScore } from "@/lib/scoring";
import { AmenityPOI, CrimeMetric, Property, RouteMetric, UserPreferences } from "@/lib/types/domain";

const now = "2026-04-20T00:00:00.000Z";

function buildBaseProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    canonicalAddress: "1 Test St",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    lat: 34.01,
    lng: -118.25,
    propertyType: "apartment",
    listingType: "manual",
    beds: 2,
    baths: 1,
    squareFeet: 900,
    price: 3200,
    amenities: [],
    images: [],
    providerKeys: ["manual-address"],
    sourceSummary: "Manual address",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function disabledPoiMustHaves() {
  return {
    park: {
      enabled: false,
      requireWalk: true,
      maxWalkMinutes: 15,
      requireDrive: true,
      maxDriveMinutes: 8,
      enforceMinimumCount: false,
      minimumCount: 0,
      countRadiusMiles: 1
    },
    restaurant: {
      enabled: false,
      requireWalk: true,
      maxWalkMinutes: 15,
      requireDrive: true,
      maxDriveMinutes: 8,
      enforceMinimumCount: false,
      minimumCount: 0,
      countRadiusMiles: 1.5
    },
    bar: {
      enabled: false,
      requireWalk: true,
      maxWalkMinutes: 18,
      requireDrive: true,
      maxDriveMinutes: 10,
      enforceMinimumCount: false,
      minimumCount: 0,
      countRadiusMiles: 1.5
    },
    gym: {
      enabled: false,
      requireWalk: true,
      maxWalkMinutes: 20,
      requireDrive: true,
      maxDriveMinutes: 10,
      enforceMinimumCount: false,
      minimumCount: 0,
      countRadiusMiles: 2
    },
    coffee: {
      enabled: false,
      requireWalk: true,
      maxWalkMinutes: 12,
      requireDrive: true,
      maxDriveMinutes: 8,
      enforceMinimumCount: false,
      minimumCount: 0,
      countRadiusMiles: 1
    }
  } as const;
}

describe("computePropertyScore", () => {
  it("computes stable score outputs for a well-populated input", () => {
    const property = buildBaseProperty();
    const crimeMetrics: CrimeMetric[] = [
      {
        id: "crime-1",
        geoId: property.id,
        lat: property.lat,
        lng: property.lng,
        metricType: "overall",
        value: 0,
        normalizedScore: 82,
        sourceName: "test-safety",
        effectiveDate: now
      }
    ];
    const nearbyAmenities: AmenityPOI[] = [
      { id: "a-grocery", name: "Grocery", category: "grocery", lat: 34.011, lng: -118.252, address: "x" },
      { id: "a-park-1", name: "Park 1", category: "park", lat: 34.012, lng: -118.253, address: "x" },
      { id: "a-park-2", name: "Park 2", category: "park", lat: 34.013, lng: -118.254, address: "x" },
      { id: "a-coffee", name: "Coffee", category: "coffee", lat: 34.01, lng: -118.251, address: "x" }
    ];
    const routeMetrics: RouteMetric[] = [
      {
        id: "route-grocery",
        propertyId: property.id,
        destinationType: "grocery",
        destinationId: "a-grocery",
        destinationLabel: "Grocery",
        walkingMinutes: 8,
        driveMinutesOffPeak: 3,
        driveMinutesPeak: 5,
        sourceName: "test-route",
        updatedAt: now
      },
      {
        id: "route-park",
        propertyId: property.id,
        destinationType: "park",
        destinationId: "a-park-1",
        destinationLabel: "Park 1",
        walkingMinutes: 10,
        driveMinutesOffPeak: 4,
        driveMinutesPeak: 6,
        sourceName: "test-route",
        updatedAt: now
      },
      {
        id: "route-coffee",
        propertyId: property.id,
        destinationType: "coffee",
        destinationId: "a-coffee",
        destinationLabel: "Coffee",
        walkingMinutes: 6,
        driveMinutesOffPeak: 2,
        driveMinutesPeak: 4,
        sourceName: "test-route",
        updatedAt: now
      },
      {
        id: "route-saved-place",
        propertyId: property.id,
        destinationType: "saved-place",
        destinationId: "work",
        destinationLabel: "Work",
        walkingMinutes: 35,
        driveMinutesOffPeak: 20,
        driveMinutesPeak: 28,
        sourceName: "test-route",
        updatedAt: now
      }
    ];
    const preferences: UserPreferences = {
      ...defaultPreferences,
      settings: {
        ...defaultPreferences.settings!,
        mustHaves: {
          ...defaultPreferences.settings!.mustHaves,
          poiRules: disabledPoiMustHaves()
        }
      },
      savedPlaces: [
        {
          id: "work",
          label: "Work",
          category: "work",
          address: "Downtown",
          lat: 34.05,
          lng: -118.3,
          includeInScoring: true
        }
      ],
      hardRules: [
        { id: "safety", label: "Safety >= 70", metric: "safety-min", value: 70 },
        { id: "grocery", label: "Grocery <= 12", metric: "grocery-walk-max", value: 12 },
        { id: "parks", label: "Parks >= 2", metric: "parks-count-min", value: 2 }
      ]
    };

    const score = computePropertyScore({
      property,
      crimeMetrics,
      nearbyAmenities,
      routeMetrics,
      preferences
    });

    expect(score.overallScore).toBe(68);
    expect(score.confidenceScore).toBe(100);
    expect(score.safetyScore).toBe(82);
    expect(score.accessibilityScore).toBe(73);
    expect(score.lifestyleScore).toBe(52);
    expect(score.walkScore).toBe(81);
    expect(score.driveScore).toBe(34);
    expect(score.highlights).toEqual([
      "Strong grocery access on foot",
      "Parks feel easy to reach",
      "Good safety profile relative to nearby options",
      "Coffee and daily errands are close"
    ]);
    expect(score.tradeoffs).toEqual([
      "One or more saved places have a longer peak drive"
    ]);
    expect(score.dataCompleteness).toEqual([]);
    expect(score.failedMustHaves).toEqual([]);
  });

  it("surfaces fallback and data completeness flags when key inputs are missing", () => {
    const property = buildBaseProperty({
      id: "prop-2",
      squareFeet: undefined,
      beds: 1,
      baths: 1,
      price: 4600
    });
    const preferences: UserPreferences = {
      ...defaultPreferences,
      settings: {
        ...defaultPreferences.settings!,
        mustHaves: {
          ...defaultPreferences.settings!.mustHaves,
          poiRules: disabledPoiMustHaves()
        }
      },
      savedPlaces: [
        {
          id: "work",
          label: "Work",
          category: "work",
          address: "Downtown",
          lat: 34.05,
          lng: -118.3,
          includeInScoring: true
        }
      ],
      hardRules: [{ id: "safety", label: "Safety >= 70", metric: "safety-min", value: 70 }]
    };

    const score = computePropertyScore({
      property,
      crimeMetrics: [],
      nearbyAmenities: [],
      routeMetrics: [],
      preferences
    });

    expect(score.overallScore).toBe(42);
    expect(score.confidenceScore).toBe(28);
    expect(score.safetyScore).toBe(52);
    expect(score.walkScore).toBe(48);
    expect(score.driveScore).toBe(34);
    expect(score.tradeoffs).toContain("Safety context is below the default comfort threshold");
    expect(score.tradeoffs).toContain("Safety context is incomplete in this area");
    expect(score.failedMustHaves).toEqual(["Safety >= 70"]);
    expect(score.dataCompleteness).toEqual([
      "Safety data is unavailable, so the score uses a conservative baseline",
      "Travel-time data is limited, so commute scoring is conservative",
      "Square footage is missing and home fit is estimated",
      "Some saved places could not be routed, so personal-place scoring is partial"
    ]);
  });

  it("evaluates POI must-haves for proximity and count requirements", () => {
    const property = buildBaseProperty({ id: "prop-3" });
    const nearbyAmenities: AmenityPOI[] = [
      { id: "park-1", name: "Park 1", category: "park", lat: 34.011, lng: -118.251, address: "x" },
      { id: "park-2", name: "Park 2", category: "park", lat: 34.013, lng: -118.252, address: "x" },
      { id: "coffee-1", name: "Coffee 1", category: "coffee", lat: 34.0105, lng: -118.251, address: "x" },
      { id: "coffee-2", name: "Coffee 2", category: "coffee", lat: 34.012, lng: -118.252, address: "x" },
      { id: "coffee-3", name: "Coffee 3", category: "coffee", lat: 34.013, lng: -118.253, address: "x" }
    ];
    const routeMetrics: RouteMetric[] = [
      {
        id: "route-park",
        propertyId: property.id,
        destinationType: "park",
        destinationId: "park-1",
        destinationLabel: "Park 1",
        walkingMinutes: 9,
        driveMinutesOffPeak: 4,
        driveMinutesPeak: 6,
        sourceName: "test-route",
        updatedAt: now
      },
      {
        id: "route-coffee",
        propertyId: property.id,
        destinationType: "coffee",
        destinationId: "coffee-1",
        destinationLabel: "Coffee 1",
        walkingMinutes: 7,
        driveMinutesOffPeak: 3,
        driveMinutesPeak: 4,
        sourceName: "test-route",
        updatedAt: now
      }
    ];

    const score = computePropertyScore({
      property,
      crimeMetrics: [],
      nearbyAmenities,
      routeMetrics,
      preferences: defaultPreferences
    });

    expect(score.requirementResults.some((result) => result.ruleId === "poi-park-proximity")).toBe(true);
    expect(score.requirementResults.some((result) => result.ruleId === "poi-coffee-count")).toBe(true);
    expect(score.failedMustHaves).toContain("Bar nearby");
    expect(score.failedMustHaves).toContain("Gym nearby");
  });
});
