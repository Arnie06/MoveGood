import { describe, expect, it } from "vitest";

import { getAverageSavedPlacePeak, getMaxSavedPlacePeak, getSavedPlaceRoutes } from "@/lib/route-metrics";
import { RouteMetric } from "@/lib/types/domain";

const now = "2026-04-20T00:00:00.000Z";

describe("route-metrics helpers", () => {
  it("sorts saved-place routes by peak then off-peak then label", () => {
    const routes: RouteMetric[] = [
      {
        id: "1",
        propertyId: "p",
        destinationType: "saved-place",
        destinationId: "a",
        destinationLabel: "Beta",
        driveMinutesOffPeak: 15,
        driveMinutesPeak: 25,
        sourceName: "test",
        updatedAt: now
      },
      {
        id: "2",
        propertyId: "p",
        destinationType: "saved-place",
        destinationId: "b",
        destinationLabel: "Alpha",
        driveMinutesOffPeak: 10,
        driveMinutesPeak: 25,
        sourceName: "test",
        updatedAt: now
      },
      {
        id: "3",
        propertyId: "p",
        destinationType: "grocery",
        destinationId: "g",
        destinationLabel: "Grocery",
        walkingMinutes: 7,
        sourceName: "test",
        updatedAt: now
      },
      {
        id: "4",
        propertyId: "p",
        destinationType: "saved-place",
        destinationId: "c",
        destinationLabel: "Gamma",
        driveMinutesOffPeak: 9,
        driveMinutesPeak: 20,
        sourceName: "test",
        updatedAt: now
      }
    ];

    const sorted = getSavedPlaceRoutes(routes);
    expect(sorted.map((route) => route.id)).toEqual(["4", "2", "1"]);
    expect(getAverageSavedPlacePeak(routes)).toBeCloseTo((20 + 25 + 25) / 3, 5);
    expect(getMaxSavedPlacePeak(routes)).toBe(25);
  });

  it("returns undefined for aggregates when saved-place peak times are missing", () => {
    const routes: RouteMetric[] = [
      {
        id: "1",
        propertyId: "p",
        destinationType: "saved-place",
        destinationId: "a",
        destinationLabel: "Work",
        driveMinutesPeak: undefined,
        sourceName: "test",
        updatedAt: now
      }
    ];

    expect(getAverageSavedPlacePeak(routes)).toBeUndefined();
    expect(getMaxSavedPlacePeak(routes)).toBeUndefined();
  });
});
