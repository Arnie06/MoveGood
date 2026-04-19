import { defaultWeights } from "@/lib/constants";
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

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
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
    input.crimeMetrics.find((metric) => metric.metricType === "overall")?.normalizedScore ?? 60;

  const groceryWalk = nearestRoute(input.routeMetrics, "grocery")?.walkingMinutes ?? 16;
  const parkWalk = nearestRoute(input.routeMetrics, "park")?.walkingMinutes ?? 18;
  const maxSavedPlacePeak = getMaxSavedPlacePeak(input.routeMetrics);
  const coffeeWalk = nearestRoute(input.routeMetrics, "coffee")?.walkingMinutes ?? 18;
  const includedSavedPlaces =
    preferences?.savedPlaces.filter((place) => place.includeInScoring) ?? [];
  const savedPlaceIds = new Set(includedSavedPlaces.map((place) => place.id));
  const savedPlaceRoutes = getSavedPlaceRoutes(input.routeMetrics).filter(
    (route) =>
      (savedPlaceIds.size === 0 || savedPlaceIds.has(route.destinationId))
  );
  const savedPlacePeakTimes = savedPlaceRoutes
    .map((route) => route.driveMinutesPeak)
    .filter((value): value is number => value != null);
  const avgSavedPlacePeak = average(savedPlacePeakTimes);
  const closeSavedPlaces = savedPlacePeakTimes.filter((value) => value <= 25).length;
  const missingSavedPlaceRoutes = Math.max(0, includedSavedPlaces.length - savedPlaceRoutes.length);
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
    (100 - groceryWalk * 2.8 + countAmenities(input.nearbyAmenities, "grocery") * 3) * 0.76 +
      personalPlaceScore * 0.24
  );
  const lifestyleScore = clampScore(
    72 +
      countAmenities(input.nearbyAmenities, "park") * 4 +
      countAmenities(input.nearbyAmenities, "coffee") * 2 -
      countAmenities(input.nearbyAmenities, "bar") * 3 -
      parkWalk +
      closeSavedPlaces * 1.5
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

  const weighted =
    safetyScore * (scoreWeights.safety / 100) +
    accessibilityScore * (scoreWeights.accessibility / 100) +
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
    lifestyle: `Lifestyle rewards parks and coffee access while penalizing heavy bar density. Park walk is ${parkWalk} min and coffee walk is ${coffeeWalk} min.`
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
  if (!input.crimeMetrics.length) dataCompleteness.push("Safety data is unavailable, so the score uses a neutral fallback");
  if (!input.routeMetrics.length) dataCompleteness.push("Travel-time data is limited, so commute scoring is conservative");
  if (!input.property.squareFeet) dataCompleteness.push("Square footage is missing and home fit is estimated");
  if (includedSavedPlaces.length > 0 && missingSavedPlaceRoutes > 0) {
    dataCompleteness.push("Some saved places could not be routed, so personal-place scoring is partial");
  }

  const failedMustHaves: string[] = [];
  const requirementResults =
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

  return {
    propertyId: input.property.id,
    overallScore: clampScore(weighted),
    safetyScore,
    accessibilityScore,
    lifestyleScore,
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
