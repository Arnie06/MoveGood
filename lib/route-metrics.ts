import { RouteMetric } from "@/lib/types/domain";

export function getSavedPlaceRoutes(routes: RouteMetric[]) {
  return routes
    .filter((route) => route.destinationType === "saved-place")
    .sort((a, b) => {
      const peakDelta =
        (a.driveMinutesPeak ?? Number.POSITIVE_INFINITY) -
        (b.driveMinutesPeak ?? Number.POSITIVE_INFINITY);
      if (peakDelta !== 0) return peakDelta;

      const offPeakDelta =
        (a.driveMinutesOffPeak ?? Number.POSITIVE_INFINITY) -
        (b.driveMinutesOffPeak ?? Number.POSITIVE_INFINITY);
      if (offPeakDelta !== 0) return offPeakDelta;

      return a.destinationLabel.localeCompare(b.destinationLabel);
    });
}

export function getAverageSavedPlacePeak(routes: RouteMetric[]) {
  const peakTimes = getSavedPlaceRoutes(routes)
    .map((route) => route.driveMinutesPeak)
    .filter((value): value is number => value != null);

  if (peakTimes.length === 0) return undefined;

  return peakTimes.reduce((total, value) => total + value, 0) / peakTimes.length;
}

export function getMaxSavedPlacePeak(routes: RouteMetric[]) {
  const peakTimes = getSavedPlaceRoutes(routes)
    .map((route) => route.driveMinutesPeak)
    .filter((value): value is number => value != null);

  if (peakTimes.length === 0) return undefined;

  return Math.max(...peakTimes);
}
