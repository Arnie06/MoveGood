"use client";

import { Fragment, useMemo } from "react";

import { useLocationStore } from "@/components/providers/location-store-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getNearestRouteByType, getSavedPlaceRoutes } from "@/lib/route-metrics";
import { AmenityCategory, AmenityPOI, PropertyScore, RouteMetric, SavedAnalyzedLocation } from "@/lib/types/domain";
import { formatMinutes } from "@/lib/utils";

const poiWalkCategories: AmenityCategory[] = ["grocery", "gym", "park", "restaurant", "coffee", "bar"];

type SavedPlaceTime = "walk" | "avg" | "peak";

type CompareRow =
  | {
      key: string;
      label: string;
      section: "Scores" | "Nearby" | "My Places";
      type: "score";
      scoreKey: keyof Pick<
        PropertyScore,
        | "overallScore"
        | "confidenceScore"
        | "safetyScore"
        | "accessibilityScore"
        | "lifestyleScore"
        | "walkScore"
        | "driveScore"
        | "affordabilityScore"
        | "homeFitScore"
      >;
    }
  | {
      key: string;
      label: string;
      section: "Scores" | "Nearby" | "My Places";
      type: "travel";
      metric: "parksCount";
    }
  | {
      key: string;
      label: string;
      section: "Scores" | "Nearby" | "My Places";
      type: "poiWalk";
      category: AmenityCategory;
    }
  | {
      key: string;
      label: string;
      section: "Scores" | "Nearby" | "My Places";
      type: "savedPlaceTime";
      destinationId: string;
      timeType: SavedPlaceTime;
    };

function toTitle(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

const scoreRows: CompareRow[] = [
  { key: "overall", label: "Overall score", section: "Scores", type: "score", scoreKey: "overallScore" },
  { key: "confidence", label: "Confidence", section: "Scores", type: "score", scoreKey: "confidenceScore" },
  { key: "safety", label: "Safety", section: "Scores", type: "score", scoreKey: "safetyScore" },
  { key: "accessibility", label: "Accessibility", section: "Scores", type: "score", scoreKey: "accessibilityScore" },
  { key: "lifestyle", label: "Lifestyle", section: "Scores", type: "score", scoreKey: "lifestyleScore" },
  { key: "walk", label: "Walk", section: "Scores", type: "score", scoreKey: "walkScore" },
  { key: "drive", label: "Drive", section: "Scores", type: "score", scoreKey: "driveScore" },
  { key: "affordability", label: "Affordability", section: "Scores", type: "score", scoreKey: "affordabilityScore" },
  { key: "homeFit", label: "Home fit", section: "Scores", type: "score", scoreKey: "homeFitScore" }
];

const nearbyRows: CompareRow[] = [
  { key: "parksCount", label: "Nearby parks", section: "Nearby", type: "travel", metric: "parksCount" },
  ...poiWalkCategories.map((category) => ({
    key: `poi-${category}-walk`,
    label: `Nearest ${toTitle(category)} walk`,
    section: "Nearby" as const,
    type: "poiWalk" as const,
    category
  }))
];

function toArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function estimateRouteTimes(distanceMiles: number) {
  const driveMinutesOffPeak = Math.max(2, Math.round(distanceMiles * 4.5));
  const driveMinutesPeak = Math.max(driveMinutesOffPeak + 2, Math.round(driveMinutesOffPeak * 1.5));
  const walkingMinutes = Math.max(4, Math.round(distanceMiles * 20));
  return { driveMinutesOffPeak, driveMinutesPeak, walkingMinutes };
}

function getAverageDriveMinutes(offPeak?: number, peak?: number) {
  if (offPeak != null && peak != null) return (offPeak + peak) / 2;
  return offPeak ?? peak;
}

function estimateWalkFromDrive(offPeak?: number, peak?: number) {
  const referenceDrive = getAverageDriveMinutes(offPeak, peak);
  if (referenceDrive == null) return undefined;
  return Math.max(4, Math.round((referenceDrive / 4.5) * 20));
}

type RowValue = {
  numericValue?: number;
  displayValue: string;
  isEstimated: boolean;
};

type DerivedComparedLocation = {
  id: string;
  name: string;
  canonicalAddress: string;
  lat: number;
  lng: number;
  score: PropertyScore | null;
  nearbyAmenities: AmenityPOI[];
  routeMetrics: RouteMetric[];
  savedPlaceRouteById: Map<string, RouteMetric>;
  nearestRouteByCategory: Map<AmenityCategory, RouteMetric | undefined>;
  nearestAmenityByCategory: Map<AmenityCategory, AmenityPOI | undefined>;
};

function getNearestAmenityByCategory(
  amenities: AmenityPOI[],
  category: AmenityCategory,
  lat: number,
  lng: number
) {
  const matching = amenities.filter((amenity) => amenity.category === category);
  if (matching.length === 0) return undefined;
  return matching.sort((a, b) => {
    const distanceA = haversineMiles(lat, lng, a.lat, a.lng);
    const distanceB = haversineMiles(lat, lng, b.lat, b.lng);
    return distanceA - distanceB;
  })[0];
}

function buildDerivedComparedLocation(location: SavedAnalyzedLocation): DerivedComparedLocation {
  const score = location.analysis?.score ?? null;
  const propertyLat = location.analysis?.property?.lat ?? location.lat;
  const propertyLng = location.analysis?.property?.lng ?? location.lng;
  const routeMetrics = toArray(location.analysis?.routeMetrics);
  const nearbyAmenities = toArray(location.analysis?.nearbyAmenities);
  const savedPlaceRoutes = getSavedPlaceRoutes(routeMetrics);

  const savedPlaceRouteById = new Map<string, RouteMetric>();
  savedPlaceRoutes.forEach((route) => {
    if (!savedPlaceRouteById.has(route.destinationId)) {
      savedPlaceRouteById.set(route.destinationId, route);
    }
  });

  const nearestRouteByCategory = new Map<AmenityCategory, RouteMetric | undefined>();
  const nearestAmenityByCategory = new Map<AmenityCategory, AmenityPOI | undefined>();

  poiWalkCategories.forEach((category) => {
    nearestRouteByCategory.set(category, getNearestRouteByType(routeMetrics, category));
    nearestAmenityByCategory.set(
      category,
      getNearestAmenityByCategory(nearbyAmenities, category, propertyLat, propertyLng)
    );
  });

  return {
    id: location.id,
    name: location.name,
    canonicalAddress: location.canonicalAddress,
    lat: propertyLat,
    lng: propertyLng,
    score,
    nearbyAmenities,
    routeMetrics,
    savedPlaceRouteById,
    nearestRouteByCategory,
    nearestAmenityByCategory
  };
}

function formatScore(value?: number) {
  if (value == null) return "Unavailable";
  return `${Math.round(value)} / 100`;
}

export function LocationCompareTable() {
  const { preferences } = usePreferences();
  const { savedLocations, compareIds, setCompareIncluded, removeLocation } = useLocationStore();

  const comparedLocations = useMemo(
    () => savedLocations.filter((location) => compareIds.includes(location.id)),
    [compareIds, savedLocations]
  );

  const derivedComparedLocations = useMemo(
    () => comparedLocations.map((location) => buildDerivedComparedLocation(location)),
    [comparedLocations]
  );

  const savedPlaceLookup = useMemo(
    () =>
      new Map(
        preferences.savedPlaces.map((place) => [
          place.id,
          { id: place.id, label: place.label, lat: place.lat, lng: place.lng }
        ])
      ),
    [preferences.savedPlaces]
  );

  const savedPlaceRows = useMemo(() => {
    const uniqueRows = new Map<string, { destinationId: string; destinationLabel: string }>();

    preferences.savedPlaces.forEach((place) => {
      uniqueRows.set(place.id, {
        destinationId: place.id,
        destinationLabel: place.label
      });
    });

    derivedComparedLocations.forEach((location) => {
      getSavedPlaceRoutes(location.routeMetrics).forEach((route) => {
        if (!uniqueRows.has(route.destinationId)) {
          uniqueRows.set(route.destinationId, {
            destinationId: route.destinationId,
            destinationLabel: route.destinationLabel
          });
        }
      });
    });

    const sortedPlaces = Array.from(uniqueRows.values()).sort((a, b) =>
      a.destinationLabel.localeCompare(b.destinationLabel)
    );

    return sortedPlaces.flatMap((place) =>
      (["walk", "avg", "peak"] as SavedPlaceTime[]).map((timeType) => ({
        key: `saved-place-${place.destinationId}-${timeType}`,
        label:
          timeType === "walk"
            ? `${place.destinationLabel} walk`
            : timeType === "avg"
              ? `${place.destinationLabel} drive avg`
              : `${place.destinationLabel} drive peak`,
        section: "My Places" as const,
        type: "savedPlaceTime" as const,
        destinationId: place.destinationId,
        timeType
      }))
    );
  }, [derivedComparedLocations, preferences.savedPlaces]);

  const compareRows = useMemo(() => [...scoreRows, ...nearbyRows, ...savedPlaceRows], [savedPlaceRows]);

  function getRowValue(row: CompareRow, location: DerivedComparedLocation): RowValue {
    if (row.type === "score") {
      const numericValue = location.score?.[row.scoreKey];
      return {
        numericValue,
        displayValue: formatScore(numericValue),
        isEstimated: false
      };
    }

    if (row.type === "travel" && row.metric === "parksCount") {
      const numericValue = location.nearbyAmenities.filter((amenity) => amenity.category === "park").length;
      return {
        numericValue,
        displayValue: String(numericValue),
        isEstimated: false
      };
    }

    if (row.type === "poiWalk") {
      const nearestRoute = location.nearestRouteByCategory.get(row.category);
      const nearestAmenity = location.nearestAmenityByCategory.get(row.category);

      const estimatedFromAmenity =
        nearestAmenity != null
          ? estimateRouteTimes(
              haversineMiles(location.lat, location.lng, nearestAmenity.lat, nearestAmenity.lng)
            ).walkingMinutes
          : undefined;

      const numericValue =
        nearestRoute?.walkingMinutes ??
        estimateWalkFromDrive(nearestRoute?.driveMinutesOffPeak, nearestRoute?.driveMinutesPeak) ??
        estimatedFromAmenity;

      return {
        numericValue,
        displayValue: formatMinutes(numericValue),
        isEstimated: nearestRoute?.walkingMinutes == null && numericValue != null
      };
    }

    if (row.type !== "savedPlaceTime") {
      return {
        displayValue: "Unavailable",
        isEstimated: false
      };
    }

    const savedPlaceRoute = location.savedPlaceRouteById.get(row.destinationId);
    const savedPlace = savedPlaceLookup.get(row.destinationId);

    const estimatedSavedPlaceRoute =
      savedPlace != null
        ? estimateRouteTimes(haversineMiles(location.lat, location.lng, savedPlace.lat, savedPlace.lng))
        : undefined;

    const numericValue =
      row.timeType === "walk"
        ? savedPlaceRoute?.walkingMinutes ?? estimatedSavedPlaceRoute?.walkingMinutes
        : row.timeType === "avg"
          ? getAverageDriveMinutes(
              savedPlaceRoute?.driveMinutesOffPeak ?? estimatedSavedPlaceRoute?.driveMinutesOffPeak,
              savedPlaceRoute?.driveMinutesPeak ?? estimatedSavedPlaceRoute?.driveMinutesPeak
            )
          : savedPlaceRoute?.driveMinutesPeak ?? estimatedSavedPlaceRoute?.driveMinutesPeak;

    return {
      numericValue,
      displayValue: formatMinutes(numericValue),
      isEstimated: savedPlaceRoute == null && numericValue != null
    };
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
            Saved Locations
          </div>
          <h3 className="font-display text-2xl text-ink">Choose what to compare</h3>
          <p className="mt-2 text-sm text-gray-600">
            Pick at least two locations for a side-by-side shortlist. Compare values marked "Est." are smart
            distance-based estimates when live routing data is missing.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {savedLocations.map((location) => (
            <div key={location.id} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="font-semibold text-ink">{location.name}</div>
              <div className="mt-1 text-sm text-gray-500">{location.canonicalAddress}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant={compareIds.includes(location.id) ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setCompareIncluded(location.id, !compareIds.includes(location.id))}
                >
                  {compareIds.includes(location.id) ? "Included" : "Add to compare"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeLocation(location.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {savedLocations.length === 0 ? (
            <div className="rounded-2xl bg-black/[0.03] p-4 text-sm text-gray-500">
              Save locations from the map browser first, then they will appear here for comparison.
            </div>
          ) : null}
        </div>
      </Card>

      {derivedComparedLocations.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-black/10 bg-black/[0.02] px-5 py-4 text-sm text-gray-700">
            Comparing <span className="font-semibold text-ink">{derivedComparedLocations.length}</span> location
            {derivedComparedLocations.length === 1 ? "" : "s"} across <span className="font-semibold text-ink">{compareRows.length}</span> criteria.
          </div>
          <div className="overflow-x-auto">
            <div
              className="grid gap-px bg-black/5"
              style={{
                gridTemplateColumns: `minmax(220px, 260px) repeat(${derivedComparedLocations.length}, minmax(210px, 1fr))`
              }}
            >
              <div className="sticky left-0 z-20 bg-white p-4 font-semibold text-ink">Metric</div>
              {derivedComparedLocations.map((location) => (
                <div key={location.id} className="bg-white p-4">
                  <div className="font-semibold text-ink">{location.name}</div>
                  <div className="mt-1 text-sm text-gray-500">{location.canonicalAddress}</div>
                </div>
              ))}

              {(["Scores", "Nearby", "My Places"] as const).map((section) => (
                <Fragment key={section}>
                  <div
                    className="sticky left-0 z-10 bg-black/[0.04] p-3 text-xs font-semibold uppercase tracking-[0.16em] text-ocean"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    {section}
                  </div>
                  {compareRows
                    .filter((row) => row.section === section)
                    .map((row) => {
                      const rowValues = derivedComparedLocations.map((location) => getRowValue(row, location));
                      const numericValues = rowValues
                        .map((value) => value.numericValue)
                        .filter((value): value is number => value != null);

                      const bestValue =
                        numericValues.length === 0
                          ? undefined
                          : row.type === "score" || row.type === "travel"
                            ? Math.max(...numericValues)
                            : Math.min(...numericValues);

                      return (
                        <Fragment key={row.key}>
                          <div className="sticky left-0 z-10 bg-white/90 p-4 text-sm font-medium text-gray-700">
                            {row.label}
                          </div>
                          {rowValues.map((value, index) => {
                            const numericValue = value.numericValue;
                            const isBest =
                              numericValue != null &&
                              bestValue != null &&
                              Math.abs(numericValue - bestValue) < 0.0001;

                            return (
                              <div
                                key={`${row.key}-${derivedComparedLocations[index].id}`}
                                className={`bg-white/80 p-4 text-sm text-ink ${
                                  isBest ? "font-semibold text-ocean" : ""
                                }`}
                              >
                                <span>{value.displayValue}</span>
                                {value.isEstimated ? (
                                  <span className="ml-2 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                    Est.
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                </Fragment>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-gray-500">
          Pick one or more saved locations above to compare their scores and distances side by side.
        </Card>
      )}
    </div>
  );
}
