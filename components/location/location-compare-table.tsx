"use client";

import { Fragment, useMemo } from "react";

import { useLocationStore } from "@/components/providers/location-store-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getNearestRouteByType,
  getSavedPlaceRoutes
} from "@/lib/route-metrics";
import { AmenityCategory } from "@/lib/types/domain";
import { formatMinutes } from "@/lib/utils";

const poiWalkCategories: AmenityCategory[] = [
  "grocery",
  "gym",
  "park",
  "restaurant",
  "coffee",
  "bar"
];

function toTitle(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

const staticRows = [
  { key: "overall", label: "Overall score", type: "score" as const },
  { key: "confidence", label: "Confidence", type: "score" as const },
  { key: "safety", label: "Safety", type: "score" as const },
  { key: "accessibility", label: "Accessibility", type: "score" as const },
  { key: "lifestyle", label: "Lifestyle", type: "score" as const },
  { key: "walk", label: "Walk", type: "score" as const },
  { key: "drive", label: "Drive", type: "score" as const },
  { key: "affordability", label: "Affordability", type: "score" as const },
  { key: "homeFit", label: "Home fit", type: "score" as const },
  { key: "savedPlacesAverage", label: "Average saved place peak drive", type: "travel" as const },
  { key: "parksCount", label: "Nearby parks", type: "travel" as const }
];

const poiWalkRows = poiWalkCategories.map((category) => ({
  key: `poi-${category}-walk`,
  label: `Nearest ${toTitle(category)} walk`,
  type: "poiWalk" as const,
  category
}));

type SavedPlaceTime = "walk" | "avg" | "peak";

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

export function LocationCompareTable() {
  const { preferences } = usePreferences();
  const { savedLocations, compareIds, setCompareIncluded, removeLocation } = useLocationStore();

  const comparedLocations = useMemo(
    () => savedLocations.filter((location) => compareIds.includes(location.id)),
    [compareIds, savedLocations]
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

    comparedLocations.forEach((location) => {
      getSavedPlaceRoutes(location.analysis.routeMetrics).forEach((route) => {
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
        type: "savedPlaceTime" as const,
        destinationId: place.destinationId,
        timeType
      }))
    );
  }, [comparedLocations, preferences.savedPlaces]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
            Saved Locations
          </div>
          <h3 className="font-display text-2xl text-ink">Choose what to compare</h3>
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
                  onClick={() =>
                    setCompareIncluded(location.id, !compareIds.includes(location.id))
                  }
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

      {comparedLocations.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <div
            className="grid gap-px bg-black/5"
            style={{ gridTemplateColumns: `220px repeat(${comparedLocations.length}, minmax(0, 1fr))` }}
          >
            <div className="bg-white/80 p-4 font-semibold text-ink">Compare</div>
            {comparedLocations.map((location) => (
              <div key={location.id} className="bg-white/80 p-4">
                <div className="font-semibold text-ink">{location.name}</div>
                <div className="mt-1 text-sm text-gray-500">{location.canonicalAddress}</div>
              </div>
            ))}
            {[...staticRows, ...poiWalkRows, ...savedPlaceRows].map((row) => (
              <Fragment key={row.key}>
                <div key={`${row.key}-label`} className="bg-white/60 p-4 text-sm font-medium text-gray-600">
                  {row.label}
                </div>
                {comparedLocations.map((location) => {
                  const savedPlaceRoutes = getSavedPlaceRoutes(location.analysis.routeMetrics);
                  const parks = location.analysis.nearbyAmenities.filter(
                    (amenity) => amenity.category === "park"
                  ).length;
                  const savedPlaceRoute =
                    row.type === "savedPlaceTime"
                      ? savedPlaceRoutes.find((route) => route.destinationId === row.destinationId)
                      : undefined;
                  const savedPlace = row.type === "savedPlaceTime" ? savedPlaceLookup.get(row.destinationId) : undefined;
                  const estimatedSavedPlaceRoute =
                    row.type === "savedPlaceTime" && savedPlace
                      ? estimateRouteTimes(
                          haversineMiles(
                            location.analysis.property.lat,
                            location.analysis.property.lng,
                            savedPlace.lat,
                            savedPlace.lng
                          )
                        )
                      : undefined;
                  const nearestAmenityForCategory =
                    row.type === "poiWalk"
                      ? location.analysis.nearbyAmenities
                          .filter((amenity) => amenity.category === row.category)
                          .sort((a, b) => {
                            const distanceA = haversineMiles(
                              location.analysis.property.lat,
                              location.analysis.property.lng,
                              a.lat,
                              a.lng
                            );
                            const distanceB = haversineMiles(
                              location.analysis.property.lat,
                              location.analysis.property.lng,
                              b.lat,
                              b.lng
                            );
                            return distanceA - distanceB;
                          })[0]
                      : undefined;
                  const estimatedPoiWalkMinutes =
                    row.type === "poiWalk" && nearestAmenityForCategory
                      ? estimateRouteTimes(
                          haversineMiles(
                            location.analysis.property.lat,
                            location.analysis.property.lng,
                            nearestAmenityForCategory.lat,
                            nearestAmenityForCategory.lng
                          )
                        ).walkingMinutes
                      : undefined;
                  const allSavedPlacePeakValues = [
                    ...savedPlaceRoutes
                      .map((route) => route.driveMinutesPeak)
                      .filter((value): value is number => value != null),
                    ...preferences.savedPlaces
                      .filter((place) =>
                        !savedPlaceRoutes.some((route) => route.destinationId === place.id)
                      )
                      .map((place) =>
                        estimateRouteTimes(
                          haversineMiles(
                            location.analysis.property.lat,
                            location.analysis.property.lng,
                            place.lat,
                            place.lng
                          )
                        ).driveMinutesPeak
                      )
                  ];
                  const averageSavedPlacePeak =
                    allSavedPlacePeakValues.length > 0
                      ? allSavedPlacePeakValues.reduce((total, value) => total + value, 0) /
                        allSavedPlacePeakValues.length
                      : undefined;

                  const value =
                    row.type === "score"
                      ? row.key === "overall"
                        ? location.analysis.score.overallScore
                        : row.key === "confidence"
                          ? location.analysis.score.confidenceScore
                          : row.key === "safety"
                            ? location.analysis.score.safetyScore
                            : row.key === "accessibility"
                              ? location.analysis.score.accessibilityScore
                              : row.key === "lifestyle"
                                ? location.analysis.score.lifestyleScore
                                : row.key === "walk"
                                  ? location.analysis.score.walkScore
                                  : row.key === "drive"
                                    ? location.analysis.score.driveScore
                                    : row.key === "affordability"
                                      ? location.analysis.score.affordabilityScore
                                      : location.analysis.score.homeFitScore
                      : row.type === "travel"
                        ? row.key === "savedPlacesAverage"
                          ? formatMinutes(averageSavedPlacePeak)
                          : parks
                        : row.type === "poiWalk"
                          ? formatMinutes(
                              getNearestRouteByType(location.analysis.routeMetrics, row.category)
                                ?.walkingMinutes ?? estimatedPoiWalkMinutes
                            )
                          : formatMinutes(
                              row.timeType === "walk"
                                ? savedPlaceRoute?.walkingMinutes ?? estimatedSavedPlaceRoute?.walkingMinutes
                                : row.timeType === "avg"
                                  ? getAverageDriveMinutes(
                                      savedPlaceRoute?.driveMinutesOffPeak ??
                                        estimatedSavedPlaceRoute?.driveMinutesOffPeak,
                                      savedPlaceRoute?.driveMinutesPeak ??
                                        estimatedSavedPlaceRoute?.driveMinutesPeak
                                    )
                                  : savedPlaceRoute?.driveMinutesPeak ??
                                    estimatedSavedPlaceRoute?.driveMinutesPeak
                            );

                  return (
                    <div key={`${row.key}-${location.id}`} className="bg-white/60 p-4 text-sm text-ink">
                      {value}
                    </div>
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
