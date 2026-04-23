import { defaultPreferences } from "@/lib/constants";
import { isLocalOnlyMode } from "@/lib/env";
import {
  readCachedAutocomplete,
  readCachedGeocode,
  readCachedReverseGeocode,
  writeCachedAutocomplete,
  writeCachedGeocode,
  writeCachedReverseGeocode
} from "@/lib/geocode-cache";
import { getLocalPoisInBounds } from "@/lib/local-pois";
import { getLosAngelesAmenitiesInBounds, isWithinLosAngelesBounds } from "@/lib/los-angeles-pois";
import { buildManualPropertyId } from "@/lib/manual-property";
import { buildLiveSources } from "@/lib/providers/live";
import {
  buildMockFallbackSources,
  getGeocoderProvider,
  getPoiProvider,
  getRoutingProvider,
  getSafetyProvider
} from "@/lib/providers/registry";
import { MockSafetyProvider } from "@/lib/providers/mock";
import { computePropertyScore } from "@/lib/scoring";
import {
  AnalyzedLocation,
  AmenityPOI,
  GeocodedLocation,
  Property,
  RouteMetric,
  SavedPlace,
  UserPreferences
} from "@/lib/types/domain";

const poiProvider = getPoiProvider();
const safetyProvider = getSafetyProvider();
const mockSafetyProvider = new MockSafetyProvider();
const routingProvider = getRoutingProvider();
export const geocoderProvider = getGeocoderProvider();

type ManualAddressOverrides = {
  price?: number;
  beds?: number;
  baths?: number;
  squareFeet?: number;
};

function buildManualPropertyFromLocation(
  geocoded: GeocodedLocation,
  overrides?: ManualAddressOverrides & { label?: string }
): Property {
  return {
    id: buildManualPropertyId(geocoded.canonicalAddress),
    canonicalAddress: geocoded.canonicalAddress,
    city: geocoded.city,
    state: geocoded.state,
    zipCode: geocoded.zipCode,
    neighborhood: overrides?.label || geocoded.city,
    lat: geocoded.lat,
    lng: geocoded.lng,
    propertyType: "apartment",
    listingType: "manual",
    beds: overrides?.beds ?? 2,
    baths: overrides?.baths ?? 1,
    squareFeet: overrides?.squareFeet ?? 900,
    price: overrides?.price ?? 3200,
    amenities: [],
    images: [],
    description:
      "User-selected location evaluated with the same neighborhood, route, and amenity scoring used throughout the app.",
    providerKeys: ["manual-address"],
    sourceSummary: overrides?.label ? `Selected location: ${overrides.label}` : "Manual address",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function hasUsableCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01;
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

function buildBoundsFromRadius(lat: number, lng: number, radiusMiles: number) {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  return {
    west: lng - lngDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    north: lat + latDelta
  };
}

function offsetCoordinate(
  lat: number,
  lng: number,
  distanceMiles: number,
  bearingDegrees: number
) {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const milesPerLatDegree = 69;
  const milesPerLngDegree = Math.max(14, 69 * Math.cos((lat * Math.PI) / 180));

  return {
    lat: lat + (Math.cos(bearing) * distanceMiles) / milesPerLatDegree,
    lng: lng + (Math.sin(bearing) * distanceMiles) / milesPerLngDegree
  };
}

function buildEstimatedAmenities(lat: number, lng: number): AmenityPOI[] {
  const blueprints: Array<{
    category: AmenityPOI["category"];
    label: string;
    miles: number;
    bearing: number;
  }> = [
    { category: "grocery", label: "Estimated Grocery", miles: 0.55, bearing: 15 },
    { category: "gym", label: "Estimated Gym", miles: 0.85, bearing: 72 },
    { category: "park", label: "Estimated Park", miles: 0.95, bearing: 132 },
    { category: "restaurant", label: "Estimated Restaurant", miles: 0.7, bearing: 198 },
    { category: "coffee", label: "Estimated Cafe", miles: 0.4, bearing: 246 },
    { category: "bar", label: "Estimated Bar", miles: 0.9, bearing: 308 }
  ];

  return blueprints.map((entry, index) => {
    const point = offsetCoordinate(lat, lng, entry.miles, entry.bearing);
    return {
      id: `estimated-${entry.category}-${index}`,
      name: entry.label,
      category: entry.category,
      lat: point.lat,
      lng: point.lng,
      address: "Estimated from local-only mode",
      metadata: {
        estimated: true,
        localOnly: true
      }
    } satisfies AmenityPOI;
  });
}

function buildEstimatedRouteMetrics(input: {
  propertyId: string;
  propertyLat: number;
  propertyLng: number;
  destinations: Array<SavedPlace | AmenityPOI>;
}): RouteMetric[] {
  return input.destinations.map((destination) => {
    const distanceMiles = haversineMiles(
      input.propertyLat,
      input.propertyLng,
      destination.lat,
      destination.lng
    );
    const driveMinutesOffPeak = Math.max(2, Math.round(distanceMiles * 4.5));
    const driveMinutesPeak = Math.max(
      driveMinutesOffPeak + 2,
      Math.round(driveMinutesOffPeak * 1.5)
    );
    const walkingMinutes = Math.max(4, Math.round(distanceMiles * 20));

    return {
      id: `${input.propertyId}-${destination.id}`,
      propertyId: input.propertyId,
      destinationType:
        "includeInScoring" in destination ? "saved-place" : destination.category,
      destinationId: destination.id,
      destinationLabel: "label" in destination ? destination.label : destination.name,
      walkingMinutes,
      driveMinutesOffPeak,
      driveMinutesPeak,
      sourceName: "Estimated",
      updatedAt: new Date().toISOString()
    } satisfies RouteMetric;
  });
}

async function loadNearbyAmenities(lat: number, lng: number) {
  const categories = ["grocery", "gym", "park", "restaurant", "coffee", "bar"] as const;
  const findLocalAmenities = async (radiusMiles: number) => {
    const bounds = buildBoundsFromRadius(lat, lng, radiusMiles);
    const localAmenities = await getLocalPoisInBounds({
      ...bounds,
      categories: [...categories]
    });
    return localAmenities.filter(
      (amenity) => haversineMiles(lat, lng, amenity.lat, amenity.lng) <= radiusMiles + 0.25
    );
  };
  const nearbyLocalAmenities = await findLocalAmenities(2);
  if (nearbyLocalAmenities.length > 0) {
    return nearbyLocalAmenities;
  }

  if (isWithinLosAngelesBounds(lat, lng)) {
    const nearbyAmenities = await getLosAngelesAmenitiesInBounds({
      ...buildBoundsFromRadius(lat, lng, 2),
      categories: [...categories]
    });

    const radiusFiltered = nearbyAmenities.filter(
      (amenity) => haversineMiles(lat, lng, amenity.lat, amenity.lng) <= 2.25
    );

    if (radiusFiltered.length > 0) {
      return radiusFiltered;
    }

    const widerAmenities = await getLosAngelesAmenitiesInBounds({
      ...buildBoundsFromRadius(lat, lng, 4),
      categories: [...categories]
    });

    const widerRadiusFiltered = widerAmenities.filter(
      (amenity) => haversineMiles(lat, lng, amenity.lat, amenity.lng) <= 4.25
    );
    if (widerRadiusFiltered.length > 0) {
      return widerRadiusFiltered;
    }
  }

  const widerLocalAmenities = await findLocalAmenities(4);
  if (widerLocalAmenities.length > 0) {
    return widerLocalAmenities;
  }

  if (isLocalOnlyMode()) {
    return buildEstimatedAmenities(lat, lng);
  }

  const providerNearbyAmenities = await poiProvider.getNearbyAmenities({
    lat,
    lng,
    radiusMiles: 2,
    categories: [...categories]
  });
  if (providerNearbyAmenities.length > 0) {
    return providerNearbyAmenities;
  }

  const providerWiderAmenities = await poiProvider.getNearbyAmenities({
    lat,
    lng,
    radiusMiles: 4,
    categories: [...categories]
  });
  if (providerWiderAmenities.length > 0) {
    return providerWiderAmenities;
  }

  if (isWithinLosAngelesBounds(lat, lng)) {
    return buildEstimatedAmenities(lat, lng);
  }
  return [];
}

async function cachedGeocode(address: string) {
  const cached = await readCachedGeocode(address);
  if (cached !== null) {
    return cached;
  }

  const result = await geocoderProvider.geocode(address);
  await writeCachedGeocode(address, result);
  return result;
}

async function resolveAddressInput(address: string) {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) return null;

  const directMatch = await cachedGeocode(normalizedAddress);
  if (directMatch) {
    return directMatch;
  }

  const suggestion = (await cachedAutocomplete(normalizedAddress, 1))[0];
  if (!suggestion) {
    return null;
  }

  return {
    canonicalAddress: suggestion.canonicalAddress,
    lat: suggestion.lat,
    lng: suggestion.lng,
    city: suggestion.city,
    state: suggestion.state,
    zipCode: suggestion.zipCode
  } satisfies GeocodedLocation;
}

async function cachedReverseGeocode(input: { lat: number; lng: number }) {
  const cached = await readCachedReverseGeocode(input);
  if (cached !== null) {
    return cached;
  }

  const result = await geocoderProvider.reverseGeocode(input);
  await writeCachedReverseGeocode(input, result);
  return result;
}

async function cachedAutocomplete(query: string, limit: number) {
  const cached = await readCachedAutocomplete(query, limit);
  if (cached !== null) {
    return cached;
  }

  const results = await geocoderProvider.autocomplete(query, limit);
  await writeCachedAutocomplete(query, limit, results);
  return results;
}

async function resolvePropertyLocationContext(property: Property) {
  const propertyHasCoordinates = hasUsableCoordinates(property.lat, property.lng);
  const initialAmenities = propertyHasCoordinates
    ? await loadNearbyAmenities(property.lat, property.lng)
    : [];

  if (initialAmenities.length > 0) {
    return {
      property,
      nearbyAmenities: initialAmenities
    };
  }

  const geocoded = await cachedGeocode(property.canonicalAddress);
  if (!geocoded || !hasUsableCoordinates(geocoded.lat, geocoded.lng)) {
    return {
      property,
      nearbyAmenities: initialAmenities
    };
  }

  const retriedAmenities = await loadNearbyAmenities(geocoded.lat, geocoded.lng);
  const shouldUseGeocodedProperty =
    retriedAmenities.length > 0 ||
    !propertyHasCoordinates ||
    Math.abs(property.lat - geocoded.lat) > 0.005 ||
    Math.abs(property.lng - geocoded.lng) > 0.005;

  if (!shouldUseGeocodedProperty) {
    return {
      property,
      nearbyAmenities: initialAmenities
    };
  }

  return {
    property: {
      ...property,
      canonicalAddress: geocoded.canonicalAddress || property.canonicalAddress,
      city: geocoded.city || property.city,
      state: geocoded.state || property.state,
      zipCode: geocoded.zipCode || property.zipCode,
      lat: geocoded.lat,
      lng: geocoded.lng
    },
    nearbyAmenities: retriedAmenities
  };
}

async function enrichPropertyContext(
  property: Property,
  preferences: UserPreferences
): Promise<AnalyzedLocation> {
  const { property: effectiveProperty, nearbyAmenities } =
    await resolvePropertyLocationContext(property);
  const crimeIncidents = await safetyProvider.getCrimeIncidents({
    lat: effectiveProperty.lat,
    lng: effectiveProperty.lng,
    radiusMiles: 1
  });
  let crimeMetrics = await safetyProvider.getSafetyMetrics({
    lat: effectiveProperty.lat,
    lng: effectiveProperty.lng,
    radiusMiles: 1
  });
  let effectiveCrimeIncidents = crimeIncidents;

  if (!isLocalOnlyMode() && crimeIncidents.length === 0 && crimeMetrics.length === 0) {
    effectiveCrimeIncidents = await mockSafetyProvider.getCrimeIncidents({
      lat: effectiveProperty.lat,
      lng: effectiveProperty.lng,
      radiusMiles: 1
    });
    crimeMetrics = await mockSafetyProvider.getSafetyMetrics({
      lat: effectiveProperty.lat,
      lng: effectiveProperty.lng,
      radiusMiles: 1
    });
  }
  const routingDestinations = [
    ...nearbyAmenities,
    ...preferences.savedPlaces
  ];
  const estimatedRouteMetrics = buildEstimatedRouteMetrics({
    propertyId: effectiveProperty.id,
    propertyLat: effectiveProperty.lat,
    propertyLng: effectiveProperty.lng,
    destinations: routingDestinations
  });

  let routeMetrics: RouteMetric[];
  if (effectiveProperty.listingType === "manual") {
    try {
      const liveRouteMetrics = await routingProvider.getRouteMetrics({
        propertyId: effectiveProperty.id,
        propertyLat: effectiveProperty.lat,
        propertyLng: effectiveProperty.lng,
        destinations: routingDestinations,
        includeTraffic: true
      });

      const liveRouteKey = new Set(
        liveRouteMetrics.map((route) => `${route.destinationType}:${route.destinationId}`)
      );
      const missingEstimatedRoutes = estimatedRouteMetrics.filter(
        (route) => !liveRouteKey.has(`${route.destinationType}:${route.destinationId}`)
      );
      routeMetrics =
        liveRouteMetrics.length > 0
          ? [...liveRouteMetrics, ...missingEstimatedRoutes]
          : estimatedRouteMetrics;
    } catch {
      routeMetrics = estimatedRouteMetrics;
    }
  } else {
    routeMetrics = await routingProvider.getRouteMetrics({
      propertyId: effectiveProperty.id,
      propertyLat: effectiveProperty.lat,
      propertyLng: effectiveProperty.lng,
      destinations: routingDestinations,
      includeTraffic: true
    });
  }
  const sources =
    effectiveProperty.providerKeys.some((key) => key.startsWith("rentcast"))
      ? buildLiveSources(effectiveProperty.id, effectiveProperty)
      : buildMockFallbackSources(effectiveProperty.id);
  const score = computePropertyScore({
    property: effectiveProperty,
    crimeMetrics,
    nearbyAmenities,
    routeMetrics,
    preferences
  });

  return {
    property: effectiveProperty,
    sources,
    crimeMetrics,
    crimeIncidents: effectiveCrimeIncidents,
    nearbyAmenities,
    routeMetrics,
    score
  };
}

export async function buildManualAddressContext(input: {
  address: string;
  preferences?: UserPreferences;
  overrides?: ManualAddressOverrides;
  geocoded?: Awaited<ReturnType<typeof geocoderProvider.geocode>>;
}): Promise<AnalyzedLocation | null> {
  const preferences = input.preferences ?? defaultPreferences;
  const geocoded = input.geocoded ?? (await resolveAddressInput(input.address));
  if (!geocoded) return null;
  return enrichPropertyContext(
    buildManualPropertyFromLocation(geocoded, input.overrides),
    preferences
  );
}

export async function evaluateManualAddress(address: string) {
  const geocoded = await resolveAddressInput(address);
  return geocoded;
}

export async function analyzeLocation(input: {
  address?: string;
  lat?: number;
  lng?: number;
  label?: string;
  preferences?: UserPreferences;
}) {
  const preferences = input.preferences ?? defaultPreferences;
  const coordinates =
    input.lat != null && input.lng != null
      ? {
          lat: input.lat,
          lng: input.lng
        }
      : null;

  let geocoded: GeocodedLocation | null = null;
  if (input.address?.trim()) {
    geocoded = await resolveAddressInput(input.address);
  }

  if (!geocoded && coordinates) {
    geocoded = await cachedReverseGeocode(coordinates);
  }

  if (!geocoded) return null;

  return enrichPropertyContext(
    buildManualPropertyFromLocation(geocoded, { label: input.label }),
    preferences
  );
}

export async function suggestAddresses(query: string, limit = 5) {
  return cachedAutocomplete(query, limit);
}
