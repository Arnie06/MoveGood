"use client";

import { Fragment, useMemo } from "react";

import { useLocationStore } from "@/components/providers/location-store-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getAverageSavedPlacePeak,
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

type SavedPlaceTime = "walk" | "offPeak" | "peak";

export function LocationCompareTable() {
  const { savedLocations, compareIds, setCompareIncluded, removeLocation } = useLocationStore();

  const comparedLocations = useMemo(
    () => savedLocations.filter((location) => compareIds.includes(location.id)),
    [compareIds, savedLocations]
  );
  const savedPlaceRows = useMemo(() => {
    const uniqueRows = new Map<string, { destinationId: string; destinationLabel: string }>();

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
      (["walk", "offPeak", "peak"] as SavedPlaceTime[]).map((timeType) => ({
        key: `saved-place-${place.destinationId}-${timeType}`,
        label:
          timeType === "walk"
            ? `${place.destinationLabel} walk`
            : timeType === "offPeak"
              ? `${place.destinationLabel} drive off-peak`
              : `${place.destinationLabel} drive peak`,
        type: "savedPlaceTime" as const,
        destinationId: place.destinationId,
        timeType
      }))
    );
  }, [comparedLocations]);

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
                          ? formatMinutes(getAverageSavedPlacePeak(location.analysis.routeMetrics))
                          : parks
                        : row.type === "poiWalk"
                          ? formatMinutes(
                              getNearestRouteByType(
                                location.analysis.routeMetrics,
                                row.category
                              )?.walkingMinutes
                            )
                          : formatMinutes(
                              row.timeType === "walk"
                                ? savedPlaceRoute?.walkingMinutes
                                : row.timeType === "offPeak"
                                  ? savedPlaceRoute?.driveMinutesOffPeak
                                  : savedPlaceRoute?.driveMinutesPeak
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
