import { defaultAppSettings, defaultWeights } from "@/lib/constants";
import {
  AmenityPOI,
  CrimeMetric,
  Property,
  PropertyScore,
  RouteMetric,
  UserPreferences
} from "@/lib/types/domain";
import { getMaxSavedPlacePeak, getSavedPlaceRoutes } from "@/lib/route-metrics";
import { clampScore } from "@/lib/utils";

function nearestRoute(routes: RouteMetric[], type: string) {
  return routes
    .filter((route) => route.destinationType === type)
    .sort((a, b) => (a.walkingMinutes ?? 999) - (b.walkingMinutes ?? 999))[0];
}

function countAmenities(amenities: AmenityPOI[], category: string) {
  return amenities.filter((amenity) => amenity.category === category).length;
}

function countWalkableRoutes(routes: RouteMetric[], type: string, maxWalkMinutes: number) {
  return routes.filter(
    (route) =>
      route.destinationType === type &&
      route.walkingMinutes != null &&
      route.walkingMinutes <= maxWalkMinutes
  ).length;
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
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

function toTitle(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function formatMinutesForRequirement(value?: number) {
  if (value == null) return "N/A";
  return `${Math.round(value)} min`;
}

export function computePropertyScore(input: {
  property: Property;
  crimeMetrics: CrimeMetric[];
  nearbyAmenities: AmenityPOI[];
  routeMetrics: RouteMetric[];
  preferences?: UserPreferences;
}): PropertyScore {
  const preferences = input.preferences;
  const scoreWeights = preferences?.scoringWeights ?? defaultWeights;

  const overallCrime =
    input.crimeMetrics.find((metric) => metric.metricType === "overall")?.normalizedScore ?? 52;

  const nearestGroceryRoute = nearestRoute(input.routeMetrics, "grocery");
  const nearestParkRoute = nearestRoute(input.routeMetrics, "park");
  const nearestCoffeeRoute = nearestRoute(input.routeMetrics, "coffee");
  const groceryWalk = nearestGroceryRoute?.walkingMinutes ?? 16;
  const parkWalk = nearestParkRoute?.walkingMinutes ?? 18;
  const maxSavedPlacePeak = getMaxSavedPlacePeak(input.routeMetrics);
  const coffeeWalk = nearestCoffeeRoute?.walkingMinutes ?? 18;
  const includedSavedPlaces =
    preferences?.savedPlaces.filter((place) => place.includeInScoring) ?? [];
  const savedPlaceIds = new Set(includedSavedPlaces.map((place) => place.id));
  const allSavedPlaceRoutes = getSavedPlaceRoutes(input.routeMetrics);
  const savedPlaceRoutes = allSavedPlaceRoutes.filter(
    (route) =>
      (savedPlaceIds.size === 0 || savedPlaceIds.has(route.destinationId))
  );
  const savedPlacePeakTimes = savedPlaceRoutes
    .map((route) => route.driveMinutesPeak)
    .filter((value): value is number => value != null);
  const savedPlaceOffPeakTimes = savedPlaceRoutes
    .map((route) => route.driveMinutesOffPeak)
    .filter((value): value is number => value != null);
  const avgSavedPlacePeak = average(savedPlacePeakTimes);
  const avgSavedPlaceOffPeak = average(savedPlaceOffPeakTimes);
  const closeSavedPlaces = savedPlacePeakTimes.filter((value) => value <= 25).length;
  const missingSavedPlaceRoutes = Math.max(0, includedSavedPlaces.length - savedPlaceRoutes.length);
  const groceryWalkable = countWalkableRoutes(input.routeMetrics, "grocery", 20);
  const parkWalkable = countWalkableRoutes(input.routeMetrics, "park", 20);
  const coffeeWalkable = countWalkableRoutes(input.routeMetrics, "coffee", 20);
  const barWalkable = countWalkableRoutes(input.routeMetrics, "bar", 20);
  const personalPlaceScore =
    includedSavedPlaces.length === 0
      ? 60
      : clampScore(
          100 -
            (avgSavedPlacePeak ?? 32) * 1.7 +
            closeSavedPlaces * 8 -
            missingSavedPlaceRoutes * 10
        );

  const safetyScore = clampScore(overallCrime);
  const accessibilityScore = clampScore(
    94 -
      groceryWalk * 2.6 +
      Math.min(5, groceryWalkable) * 3 +
      (personalPlaceScore - 60) * 0.38
  );
  const lifestyleScore = clampScore(
    70 -
      parkWalk * 1.8 -
      coffeeWalk * 0.9 +
      Math.min(6, parkWalkable) * 3 +
      Math.min(6, coffeeWalkable) * 2 -
      Math.min(6, barWalkable) * 1.5 +
      closeSavedPlaces
  );
  const averageWalkMinutes = average([groceryWalk, parkWalk, coffeeWalk]) ?? 18;
  const walkCoverageBoost = Math.min(
    12,
    groceryWalkable * 2 + parkWalkable * 1.5 + coffeeWalkable * 1.5
  );
  const walkScore = clampScore(100 - averageWalkMinutes * 3 + walkCoverageBoost);
  const fallbackAmenityPeakTimes = [
    nearestGroceryRoute?.driveMinutesPeak,
    nearestParkRoute?.driveMinutesPeak,
    nearestCoffeeRoute?.driveMinutesPeak
  ].filter((value): value is number => value != null);
  const fallbackAmenityOffPeakTimes = [
    nearestGroceryRoute?.driveMinutesOffPeak,
    nearestParkRoute?.driveMinutesOffPeak,
    nearestCoffeeRoute?.driveMinutesOffPeak
  ].filter((value): value is number => value != null);
  const averageDrivePeak =
    avgSavedPlacePeak ?? average(fallbackAmenityPeakTimes) ?? 28;
  const averageDriveOffPeak =
    avgSavedPlaceOffPeak ?? average(fallbackAmenityOffPeakTimes) ?? 20;
  const trafficPenalty = Math.max(0, averageDrivePeak - averageDriveOffPeak);
  const driveScore = clampScore(
    100 - averageDrivePeak * 2 + closeSavedPlaces * 4 - trafficPenalty * 1.2
  );

  const targetBudget = input.property.listingType === "sale" ? 750000 : 3200;
  const price = input.property.price ?? targetBudget;
  const affordabilityScore = clampScore(100 - ((price - targetBudget) / targetBudget) * 55);

  const beds = input.property.beds ?? 0;
  const baths = input.property.baths ?? 0;
  const sqft = input.property.squareFeet ?? 650;
  const homeFitScore = clampScore(
    45 + beds * 15 + baths * 8 + Math.min(18, Math.round((sqft - 600) / 40))
  );

  const confidenceScore = clampScore(
    100 -
      (input.crimeMetrics.length === 0 ? 28 : 0) -
      (input.routeMetrics.length === 0 ? 36 : 0) -
      Math.min(24, missingSavedPlaceRoutes * 8)
  );

  const weighted =
    safetyScore * (scoreWeights.safety / 100) +
    accessibilityScore * (scoreWeights.accessibility / 100) +
    walkScore * (scoreWeights.walk / 100) +
    driveScore * (scoreWeights.drive / 100) +
    affordabilityScore * (scoreWeights.affordability / 100) +
    homeFitScore * (scoreWeights.homeFit / 100) +
    lifestyleScore * (scoreWeights.lifestyle / 100);

  const explanations = {
    overall:
      "Overall blends safety, accessibility, and lifestyle. Affordability and home fit are not part of the current default score weighting.",
    safety: `Safety starts from nearby crime context and currently scores ${safetyScore} using the local overall safety metric.`,
    accessibility:
      includedSavedPlaces.length > 0
        ? `Accessibility rewards daily essentials and your included saved places. Grocery walk is ${groceryWalk} min and access across your personal places is folded in.`
        : `Accessibility rewards daily essentials first. Grocery walk is ${groceryWalk} min and nearby essentials are weighted heavily.`,
    lifestyle: `Lifestyle rewards parks and coffee access while penalizing heavy bar density. Park walk is ${parkWalk} min and coffee walk is ${coffeeWalk} min.`,
    walk: `Walk score blends your nearest grocery, park, and coffee walks. Current average walk is ${Math.round(averageWalkMinutes)} min.`,
    drive: `Drive score emphasizes peak-time accessibility. Current average peak drive is ${Math.round(averageDrivePeak)} min with a ${Math.round(trafficPenalty)} min traffic penalty.`
  } as const;

  const highlights: string[] = [];
  const tradeoffs: string[] = [];
  const dataCompleteness: string[] = [];

  if (groceryWalk <= 10) highlights.push("Strong grocery access on foot");
  if (parkWalk <= 12) highlights.push("Parks feel easy to reach");
  if (safetyScore >= 78) highlights.push("Good safety profile relative to nearby options");
  if (coffeeWalk <= 8) highlights.push("Coffee and daily errands are close");
  if (includedSavedPlaces.length > 0 && closeSavedPlaces > 0) {
    highlights.push(
      `${closeSavedPlaces} saved ${closeSavedPlaces === 1 ? "place stays" : "places stay"} within a manageable drive`
    );
  }
  if (affordabilityScore < 58) tradeoffs.push("Price looks high for this size");
  if ((maxSavedPlacePeak ?? 0) > 25) {
    tradeoffs.push("One or more saved places have a longer peak drive");
  }
  if (safetyScore < 65) tradeoffs.push("Safety context is below the default comfort threshold");
  if (includedSavedPlaces.length > 0 && (avgSavedPlacePeak ?? 0) > 30) {
    tradeoffs.push("Included personal places are a longer drive on average");
  }
  if (!input.crimeMetrics.length) tradeoffs.push("Safety context is incomplete in this area");
  if (!input.crimeMetrics.length) {
    dataCompleteness.push("Safety data is unavailable, so the score uses a conservative baseline");
  }
  if (!input.routeMetrics.length) dataCompleteness.push("Travel-time data is limited, so commute scoring is conservative");
  if (!input.property.squareFeet) dataCompleteness.push("Square footage is missing and home fit is estimated");
  if (includedSavedPlaces.length > 0 && missingSavedPlaceRoutes > 0) {
    dataCompleteness.push("Some saved places could not be routed, so personal-place scoring is partial");
  }

  const failedMustHaves: string[] = [];
  const requirementResults: PropertyScore["requirementResults"] = [];
  const poiMustHaveCategories = ["park", "restaurant", "bar", "gym", "coffee"] as const;
  const poiRules = preferences?.settings?.mustHaves.poiRules ?? defaultAppSettings.mustHaves.poiRules;
  const personalPlaceRules =
    preferences?.settings?.mustHaves.personalPlaces ?? defaultAppSettings.mustHaves.personalPlaces;

  poiMustHaveCategories.forEach((category) => {
    const rule = poiRules?.[category];
    if (!rule?.enabled) return;

    const nearestAmenityRoute = nearestRoute(input.routeMetrics, category);
    const walkMinutes = nearestAmenityRoute?.walkingMinutes;
    const driveMinutes = nearestAmenityRoute?.driveMinutesPeak ?? nearestAmenityRoute?.driveMinutesOffPeak;

    const requiresWalk = rule.requireWalk;
    const requiresDrive = rule.requireDrive;

    let proximityPassed = true;
    let proximityTarget = "No walk/drive threshold configured";

    if (requiresWalk && requiresDrive) {
      proximityPassed =
        (walkMinutes != null && walkMinutes <= rule.maxWalkMinutes) ||
        (driveMinutes != null && driveMinutes <= rule.maxDriveMinutes);
      proximityTarget = `Walk <= ${rule.maxWalkMinutes} min OR drive <= ${rule.maxDriveMinutes} min`;
    } else if (requiresWalk) {
      proximityPassed = walkMinutes != null && walkMinutes <= rule.maxWalkMinutes;
      proximityTarget = `Walk <= ${rule.maxWalkMinutes} min`;
    } else if (requiresDrive) {
      proximityPassed = driveMinutes != null && driveMinutes <= rule.maxDriveMinutes;
      proximityTarget = `Drive <= ${rule.maxDriveMinutes} min`;
    }

    if (requiresWalk || requiresDrive) {
      const proximityLabel = `${toTitle(category)} nearby`;
      if (!proximityPassed) {
        failedMustHaves.push(proximityLabel);
      }
      requirementResults.push({
        ruleId: `poi-${category}-proximity`,
        label: proximityLabel,
        passed: proximityPassed,
        actual: `Walk ${formatMinutesForRequirement(walkMinutes)} • Drive ${formatMinutesForRequirement(driveMinutes)}`,
        target: proximityTarget
      });
    }

    if (!rule.enforceMinimumCount) return;

    const countWithinRadius = input.nearbyAmenities.filter(
      (amenity) =>
        amenity.category === category &&
        haversineMiles(input.property.lat, input.property.lng, amenity.lat, amenity.lng) <= rule.countRadiusMiles
    ).length;

    const countPassed = countWithinRadius >= rule.minimumCount;
    const countLabel = `${toTitle(category)} count`;
    if (!countPassed) failedMustHaves.push(countLabel);
    requirementResults.push({
      ruleId: `poi-${category}-count`,
      label: `${toTitle(category)} count within ${rule.countRadiusMiles} mi`,
      passed: countPassed,
      actual: countWithinRadius,
      target: rule.minimumCount
    });
  });

  if (personalPlaceRules.enabled && (personalPlaceRules.requireWalk || personalPlaceRules.requireDrive)) {
    const targetPlaces = (preferences?.savedPlaces ?? []).filter(
      (place) => !personalPlaceRules.onlyIncludedInScoring || place.includeInScoring
    );

    targetPlaces.forEach((place) => {
      const route = allSavedPlaceRoutes.find((item) => item.destinationId === place.id);
      const walkMinutes = route?.walkingMinutes;
      const driveMinutes = route?.driveMinutesPeak ?? route?.driveMinutesOffPeak;

      let passed = true;
      let target = "No threshold configured";
      if (personalPlaceRules.requireWalk && personalPlaceRules.requireDrive) {
        passed =
          (walkMinutes != null && walkMinutes <= personalPlaceRules.maxWalkMinutes) ||
          (driveMinutes != null && driveMinutes <= personalPlaceRules.maxDriveMinutes);
        target = `Walk <= ${personalPlaceRules.maxWalkMinutes} min OR drive <= ${personalPlaceRules.maxDriveMinutes} min`;
      } else if (personalPlaceRules.requireWalk) {
        passed = walkMinutes != null && walkMinutes <= personalPlaceRules.maxWalkMinutes;
        target = `Walk <= ${personalPlaceRules.maxWalkMinutes} min`;
      } else if (personalPlaceRules.requireDrive) {
        passed = driveMinutes != null && driveMinutes <= personalPlaceRules.maxDriveMinutes;
        target = `Drive <= ${personalPlaceRules.maxDriveMinutes} min`;
      }

      const label = `Personal place: ${place.label}`;
      if (!passed) failedMustHaves.push(label);
      requirementResults.push({
        ruleId: `personal-place-${place.id}`,
        label,
        passed,
        actual: `Walk ${formatMinutesForRequirement(walkMinutes)} • Drive ${formatMinutesForRequirement(driveMinutes)}`,
        target
      });
    });
  }

  if (requirementResults.length === 0) {
    const legacyResults =
      preferences?.hardRules?.map((rule) => {
        let actual = 0;
        let passed = true;

        switch (rule.metric) {
          case "price-max":
            actual = input.property.price ?? 0;
            passed = actual <= rule.value;
            break;
          case "safety-min":
            actual = safetyScore;
            passed = actual >= rule.value;
            break;
          case "work-peak-max":
            actual = maxSavedPlacePeak ?? 0;
            passed = actual <= rule.value;
            break;
          case "grocery-walk-max":
            actual = groceryWalk;
            passed = actual <= rule.value;
            break;
          case "parks-count-min":
            actual = countAmenities(input.nearbyAmenities, "park");
            passed = actual >= rule.value;
            break;
          case "beds-min":
            actual = input.property.beds ?? 0;
            passed = actual >= rule.value;
            break;
          case "baths-min":
            actual = input.property.baths ?? 0;
            passed = actual >= rule.value;
            break;
        }

        if (!passed) failedMustHaves.push(rule.label);

        return {
          ruleId: rule.id,
          label: rule.label,
          passed,
          actual,
          target: rule.value
        };
      }) ?? [];
    requirementResults.push(...legacyResults);
  }

  return {
    propertyId: input.property.id,
    overallScore: clampScore(weighted),
    confidenceScore,
    safetyScore,
    accessibilityScore,
    lifestyleScore,
    walkScore,
    driveScore,
    affordabilityScore,
    homeFitScore,
    explanations,
    highlights,
    tradeoffs,
    failedMustHaves,
    requirementResults,
    dataCompleteness,
    computedAt: new Date().toISOString()
  };
}
