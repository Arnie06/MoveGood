import { Card } from "@/components/ui/card";
import { AnalyzedLocation, SavedPlace } from "@/lib/types/domain";
import { formatMinutes } from "@/lib/utils";

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

function getSavedPlaceRoute(item: AnalyzedLocation, place: SavedPlace) {
  return item.routeMetrics.find(
    (route) => route.destinationType === "saved-place" && route.destinationId === place.id
  );
}

function buildEstimatedRoute(item: AnalyzedLocation, place: SavedPlace) {
  const distanceMiles = haversineMiles(
    item.property.lat,
    item.property.lng,
    place.lat,
    place.lng
  );
  const driveMinutesOffPeak = Math.max(2, Math.round(distanceMiles * 4.5));
  const driveMinutesPeak = Math.max(driveMinutesOffPeak + 2, Math.round(driveMinutesOffPeak * 1.5));
  const walkingMinutes = Math.max(4, Math.round(distanceMiles * 20));

  return {
    driveMinutesOffPeak,
    driveMinutesPeak,
    walkingMinutes,
    sourceName: "Estimated"
  };
}

function getAverageDriveMinutes(offPeak?: number, peak?: number) {
  if (offPeak != null && peak != null) return (offPeak + peak) / 2;
  return offPeak ?? peak;
}

export function PreferenceTravelPanel({
  item,
  savedPlaces,
  compact = false
}: {
  item: AnalyzedLocation;
  savedPlaces: SavedPlace[];
  compact?: boolean;
}) {
  if (savedPlaces.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
          Saved Places
        </div>
        <h3 className="font-display text-2xl text-ink">Travel times for every personal place</h3>
      </div>
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        {savedPlaces.map((place) => {
          const route = getSavedPlaceRoute(item, place);
          const effectiveRoute = route ?? buildEstimatedRoute(item, place);

          return (
            <div key={place.id} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="font-semibold text-ink">{place.label}</div>
              <div className={`mt-1 text-gray-500 ${compact ? "text-base leading-7" : "text-sm"}`}>
                {place.address}
              </div>
              <div className={`mt-4 grid gap-3 text-sm ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <div className="text-gray-500">Drive avg</div>
                  <div className="font-semibold text-ink">
                    {formatMinutes(
                      getAverageDriveMinutes(
                        effectiveRoute.driveMinutesOffPeak,
                        effectiveRoute.driveMinutesPeak
                      )
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Drive peak</div>
                  <div className="font-semibold text-ink">
                    {formatMinutes(effectiveRoute.driveMinutesPeak)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Walk</div>
                  <div className="font-semibold text-ink">{formatMinutes(effectiveRoute.walkingMinutes)}</div>
                </div>
              </div>
              {!route ? (
                <div className="mt-3 text-xs text-gray-500">
                  Live routing was unavailable here, so these times are estimated from straight-line distance.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
