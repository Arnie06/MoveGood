import { Card } from "@/components/ui/card";
import { amenityColorMap } from "@/lib/poi-colors";
import { getNearestRouteByType } from "@/lib/route-metrics";
import { AnalyzedLocation } from "@/lib/types/domain";
import { formatMinutes } from "@/lib/utils";

const categories = [
  "grocery",
  "gym",
  "park",
  "restaurant",
  "coffee",
  "bar"
] as const;

function getNearestRoute(item: AnalyzedLocation, category: (typeof categories)[number]) {
  return getNearestRouteByType(item.routeMetrics, category);
}

export function AmenitiesPanel({
  item,
  compact = false
}: {
  item: AnalyzedLocation;
  compact?: boolean;
}) {
  return (
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
          const matches = item.nearbyAmenities.filter((amenity) => amenity.category === category);
          const nearestAmenity = matches[0];
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}
