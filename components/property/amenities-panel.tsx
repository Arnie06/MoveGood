"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { amenityColorMap } from "@/lib/poi-colors";
import { getNearestRouteByType } from "@/lib/route-metrics";
import { AmenityPOI, AnalyzedLocation, RouteMetric } from "@/lib/types/domain";
import { cn, formatMinutes } from "@/lib/utils";

const categories = [
  "grocery",
  "gym",
  "park",
  "restaurant",
  "coffee",
  "bar"
] as const;
type AmenityCategory = (typeof categories)[number];

type AmenityWithRoute = {
  amenity: AmenityPOI;
  route?: RouteMetric;
  distanceMiles: number;
  sourceLabel: "Local" | "Live" | "Estimated";
};

function getNearestRoute(item: AnalyzedLocation, category: AmenityCategory) {
  return getNearestRouteByType(item.routeMetrics, category);
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
  const a =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function formatDistanceMiles(value: number) {
  if (value < 0.2) return "<0.2 mi";
  return `${value.toFixed(1)} mi`;
}

function getSourceLabel(route: RouteMetric | undefined, amenity: AmenityPOI): "Local" | "Live" | "Estimated" {
  if (amenity.metadata?.estimated || route?.sourceName === "Estimated") {
    return "Estimated";
  }

  if (amenity.metadata?.localOnly || route?.sourceName === "Mock Router") {
    return "Local";
  }

  return "Live";
}

export function AmenitiesPanel({
  item,
  compact = false,
  onAmenitySelect
}: {
  item: AnalyzedLocation;
  compact?: boolean;
  onAmenitySelect?: (amenity: AmenityPOI) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<AmenityCategory | null>(null);
  const [sortMode, setSortMode] = useState<"walk" | "distance">("walk");

  useEffect(() => {
    if (!activeCategory) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveCategory(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCategory]);

  const amenitiesByCategory = useMemo(() => {
    const propertyLat = item.property.lat;
    const propertyLng = item.property.lng;
    return Object.fromEntries(
      categories.map((category) => {
        const routesForCategory = new Map(
          item.routeMetrics
            .filter((route) => route.destinationType === category)
            .map((route) => [route.destinationId, route] as const)
        );
        const rows = item.nearbyAmenities
          .filter((amenity) => amenity.category === category)
          .map((amenity) => {
            const route = routesForCategory.get(amenity.id);
            return {
              amenity,
              route,
              distanceMiles: haversineMiles(propertyLat, propertyLng, amenity.lat, amenity.lng),
              sourceLabel: getSourceLabel(route, amenity)
            } satisfies AmenityWithRoute;
          })
          .sort((left, right) => {
            const leftWalk = left.route?.walkingMinutes ?? Number.POSITIVE_INFINITY;
            const rightWalk = right.route?.walkingMinutes ?? Number.POSITIVE_INFINITY;
            if (leftWalk !== rightWalk) return leftWalk - rightWalk;
            return left.distanceMiles - right.distanceMiles;
          });

        return [category, rows];
      })
    ) as Record<AmenityCategory, AmenityWithRoute[]>;
  }, [item.nearbyAmenities, item.property.lat, item.property.lng, item.routeMetrics]);

  const activeAmenities = useMemo(() => {
    if (!activeCategory) return [];
    const rows = [...amenitiesByCategory[activeCategory]];
    if (sortMode === "distance") {
      return rows.sort((left, right) => left.distanceMiles - right.distanceMiles);
    }
    return rows.sort((left, right) => {
      const leftWalk = left.route?.walkingMinutes ?? Number.POSITIVE_INFINITY;
      const rightWalk = right.route?.walkingMinutes ?? Number.POSITIVE_INFINITY;
      if (leftWalk !== rightWalk) return leftWalk - rightWalk;
      return left.distanceMiles - right.distanceMiles;
    });
  }, [activeCategory, amenitiesByCategory, sortMode]);

  return (
    <>
      <Card className="p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
            Nearby Essentials
          </div>
          <h3 className="font-display text-2xl text-ink">What is close by</h3>
        </div>
        <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
          {categories.map((category) => {
            const route = getNearestRoute(item, category);
            const matches = amenitiesByCategory[category];
            const nearestAmenity = matches[0]?.amenity;
            const palette = amenityColorMap[category];
            return (
              <div
                key={category}
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: palette.bg,
                  borderColor: palette.border
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold capitalize" style={{ color: palette.text }}>
                    {category}
                  </div>
                  <div className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: palette.border, color: "#fff" }}>
                    {matches.length} nearby
                  </div>
                </div>
                <div className={`space-y-1 ${compact ? "text-[1.03rem] leading-8" : "text-sm"}`} style={{ color: palette.text }}>
                  <div>Nearest: {route?.destinationLabel ?? nearestAmenity?.name ?? "No nearby places found"}</div>
                  <div>Walk: {formatMinutes(route?.walkingMinutes)}</div>
                  <div>Drive off-peak: {formatMinutes(route?.driveMinutesOffPeak)}</div>
                  <div>Drive peak: {formatMinutes(route?.driveMinutesPeak)}</div>
                  {!route && nearestAmenity ? (
                    <div className="pt-1 text-xs opacity-80">Nearby place found, but travel time was not routed yet.</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex rounded-full border border-current/30 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/35"
                  style={{ color: palette.text }}
                  onClick={() => {
                    setSortMode("walk");
                    setActiveCategory(category);
                  }}
                >
                  See all ({matches.length})
                </button>
              </div>
            );
          })}
        </div>
      </Card>
      {activeCategory ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/45 md:items-stretch"
          onClick={() => setActiveCategory(null)}
        >
          <div
            className="max-h-[86vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl md:h-full md:max-h-none md:w-[560px] md:rounded-none md:rounded-l-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-black/10 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ocean/70">
                Nearby essentials
              </div>
              <div className="mt-1 flex items-center justify-between gap-4">
                <h3 className="font-display text-2xl capitalize text-ink">
                  {activeCategory} nearby ({activeAmenities.length})
                </h3>
                <button
                  type="button"
                  className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-gray-600"
                  onClick={() => setActiveCategory(null)}
                >
                  Close
                </button>
              </div>
              <div className="mt-3 inline-flex rounded-full bg-black/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setSortMode("walk")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    sortMode === "walk" ? "bg-white text-ink shadow" : "text-gray-500"
                  )}
                >
                  Sort: Walk
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("distance")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    sortMode === "distance" ? "bg-white text-ink shadow" : "text-gray-500"
                  )}
                >
                  Sort: Distance
                </button>
              </div>
            </div>
            <div className="max-h-[calc(86vh-150px)] space-y-3 overflow-y-auto px-5 py-4 md:max-h-none md:h-[calc(100%-150px)]">
              {activeAmenities.length > 0 ? (
                activeAmenities.map((entry) => (
                  <button
                    key={entry.amenity.id}
                    type="button"
                    className="w-full rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-left transition-colors hover:bg-black/[0.04]"
                    onClick={() => onAmenitySelect?.(entry.amenity)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-ink">{entry.amenity.name}</div>
                        <div className="mt-1 text-sm text-gray-600">{entry.amenity.address}</div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          entry.sourceLabel === "Estimated"
                            ? "bg-amber-100 text-amber-700"
                            : entry.sourceLabel === "Local"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {entry.sourceLabel}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 sm:grid-cols-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-gray-500">Distance</div>
                        <div>{formatDistanceMiles(entry.distanceMiles)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-gray-500">Walk</div>
                        <div>{formatMinutes(entry.route?.walkingMinutes)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-gray-500">Drive Off-Peak</div>
                        <div>{formatMinutes(entry.route?.driveMinutesOffPeak)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-gray-500">Drive Peak</div>
                        <div>{formatMinutes(entry.route?.driveMinutesPeak)}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-gray-600">
                  No nearby places in this category yet for this location.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
