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
import { formatMinutes } from "@/lib/utils";

const rows = [
  { key: "overall", label: "Overall score" },
  { key: "safety", label: "Safety" },
  { key: "accessibility", label: "Accessibility" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "grocery", label: "Nearest grocery walk" },
  { key: "savedPlacesAverage", label: "Average saved place peak drive" },
  { key: "parks", label: "Nearby parks" }
] as const;

export function LocationCompareTable() {
  const { savedLocations, compareIds, setCompareIncluded, removeLocation } = useLocationStore();

  const comparedLocations = useMemo(
    () => savedLocations.filter((location) => compareIds.includes(location.id)),
    [compareIds, savedLocations]
  );
  const savedPlaceRows = useMemo(() => {
    const uniqueRows = new Map<string, { key: string; label: string; destinationId: string }>();

    comparedLocations.forEach((location) => {
      getSavedPlaceRoutes(location.analysis.routeMetrics).forEach((route) => {
        if (!uniqueRows.has(route.destinationId)) {
          uniqueRows.set(route.destinationId, {
            key: `saved-place-${route.destinationId}`,
            label: `${route.destinationLabel} peak drive`,
            destinationId: route.destinationId
          });
        }
      });
    });

    return Array.from(uniqueRows.values()).sort((a, b) => a.label.localeCompare(b.label));
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
            {[...rows, ...savedPlaceRows].map((row) => (
              <Fragment key={row.key}>
                <div key={`${row.key}-label`} className="bg-white/60 p-4 text-sm font-medium text-gray-600">
                  {row.label}
                </div>
                {comparedLocations.map((location) => {
                  const grocery = getNearestRouteByType(
                    location.analysis.routeMetrics,
                    "grocery"
                  );
                  const savedPlaceRoutes = getSavedPlaceRoutes(location.analysis.routeMetrics);
                  const parks = location.analysis.nearbyAmenities.filter(
                    (amenity) => amenity.category === "park"
                  ).length;

                  const value =
                    row.key === "overall"
                      ? location.analysis.score.overallScore
                      : row.key === "safety"
                        ? location.analysis.score.safetyScore
                        : row.key === "accessibility"
                          ? location.analysis.score.accessibilityScore
                          : row.key === "lifestyle"
                            ? location.analysis.score.lifestyleScore
                            : row.key === "grocery"
                              ? formatMinutes(grocery?.walkingMinutes)
                              : row.key === "savedPlacesAverage"
                                ? formatMinutes(getAverageSavedPlacePeak(location.analysis.routeMetrics))
                                : row.key === "parks"
                                  ? parks
                                  : formatMinutes(
                                      savedPlaceRoutes.find(
                                        (route) =>
                                          "destinationId" in row &&
                                          route.destinationId === row.destinationId
                                      )?.driveMinutesPeak
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
