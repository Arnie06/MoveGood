import { mockAmenities, mockCrimeMetrics, mockProperties, mockRoutes } from "@/lib/data/mock-data";
import {
  GeocoderProvider,
  PoiProvider,
  RoutingProvider,
  SafetyProvider
} from "@/lib/providers/interfaces";
import {
  AddressSuggestion,
  AmenityPOI,
  GeocodedLocation,
  CrimeIncident,
  RouteMetric,
  SavedPlace
} from "@/lib/types/domain";

function approxDistanceMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const latMiles = Math.abs(aLat - bLat) * 69;
  const lngMiles = Math.abs(aLng - bLng) * 54.6;
  return Math.sqrt(latMiles * latMiles + lngMiles * lngMiles);
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export class MockGeocoderProvider implements GeocoderProvider {
  name = "mock-geocoder";

  async geocode(address: string) {
    const directMatch = mockProperties.find(
      (property) => normalize(property.canonicalAddress) === normalize(address)
    );

    if (directMatch) {
      return {
        canonicalAddress: directMatch.canonicalAddress,
        lat: directMatch.lat,
        lng: directMatch.lng,
        city: directMatch.city,
        state: directMatch.state,
        zipCode: directMatch.zipCode
      };
    }

    return null;
  }

  async reverseGeocode(input: { lat: number; lng: number }): Promise<GeocodedLocation> {
    return {
      canonicalAddress: `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`,
      lat: input.lat,
      lng: input.lng,
      city: "New York",
      state: "NY",
      zipCode: "10001"
    };
  }

  async autocomplete(query: string, limit = 5): Promise<AddressSuggestion[]> {
    if (!query.trim()) return [];

    const matches = mockProperties
      .filter((property) =>
        [
          property.canonicalAddress,
          property.city,
          property.zipCode,
          property.neighborhood ?? ""
        ].some((value) => normalize(value).includes(normalize(query)))
      )
      .slice(0, limit)
      .map((property) => ({
        label: property.canonicalAddress,
        canonicalAddress: property.canonicalAddress,
        lat: property.lat,
        lng: property.lng,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode
      }));

    if (matches.length > 0) {
      return matches;
    }

    return [];
  }
}

export class MockPoiProvider implements PoiProvider {
  name = "mock-poi";

  async getNearbyAmenities(_input: {
    lat: number;
    lng: number;
    radiusMiles: number;
    categories?: AmenityPOI["category"][];
  }) {
    return mockAmenities.filter((amenity) => {
      const matchesCategory =
        !_input.categories?.length || _input.categories.includes(amenity.category);
      const isNearby =
        approxDistanceMiles(_input.lat, _input.lng, amenity.lat, amenity.lng) <=
        _input.radiusMiles + 0.4;
      return matchesCategory && isNearby;
    });
  }
}

export class MockSafetyProvider implements SafetyProvider {
  name = "mock-safety";

  async getSafetyMetrics(input: { lat: number; lng: number; radiusMiles: number }) {
    return mockCrimeMetrics.filter(
      (metric) =>
        Math.abs(metric.lat - input.lat) < 0.08 && Math.abs(metric.lng - input.lng) < 0.08
    );
  }

  async getCrimeIncidents(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
  }): Promise<CrimeIncident[]> {
    return mockCrimeMetrics
      .filter(
        (metric) =>
          metric.metricType === "overall" &&
          approxDistanceMiles(input.lat, input.lng, metric.lat, metric.lng) <=
            input.radiusMiles + 0.3
      )
      .flatMap((metric) => {
        const incidentCount = Math.max(6, Math.min(18, Math.round(metric.value / 1.7)));

        return Array.from({ length: incidentCount }, (_, index) => {
          const angle = (index / incidentCount) * Math.PI * 2;
          const ring = 0.0025 + (index % 4) * 0.0012;
          const latOffset = Math.sin(angle) * ring;
          const lngOffset = Math.cos(angle) * ring * 0.82;
          const category =
            index % 7 === 0 ? "violent" : index % 3 === 0 ? "theft" : "property";
          const occurredAt = new Date(
            new Date(metric.effectiveDate).getTime() - index * 36 * 60 * 60 * 1000
          ).toISOString();

          return {
            id: `mock-incident-${metric.id}-${index}`,
            geoId: metric.geoId,
            lat: metric.lat + latOffset,
            lng: metric.lng + lngOffset,
            category,
            label:
              category === "violent"
                ? "Reported violent crime"
                : category === "theft"
                  ? "Reported theft"
                  : "Reported property crime",
            blockAddress: "Approx. 100 block",
            occurredAt,
            sourceName: "Mock Safety",
            metadata: {
              normalizedScore: metric.normalizedScore,
              synthetic: true
            }
          } satisfies CrimeIncident;
        });
      });
  }
}

export class MockRoutingProvider implements RoutingProvider {
  name = "mock-routing";

  async getRouteMetrics(input: {
    propertyId: string;
    propertyLat: number;
    propertyLng: number;
    destinations: Array<SavedPlace | AmenityPOI>;
    includeTraffic?: boolean;
  }): Promise<RouteMetric[]> {
    const destinationIds = new Set(input.destinations.map((destination) => destination.id));
    const matchedRoutes = mockRoutes.filter(
      (route) =>
        route.propertyId === input.propertyId &&
        (destinationIds.size === 0 || destinationIds.has(route.destinationId))
    );

    if (matchedRoutes.length > 0) {
      return matchedRoutes;
    }

    return input.destinations.map((destination) => {
      const distanceMiles = approxDistanceMiles(
        input.propertyLat,
        input.propertyLng,
        destination.lat,
        destination.lng
      );
      const walkingMinutes = Math.max(3, Math.round(distanceMiles * 20));
      const driveMinutesOffPeak = Math.max(2, Math.round(distanceMiles * 4.2));
      const driveMinutesPeak = Math.max(
        driveMinutesOffPeak + 2,
        Math.round(driveMinutesOffPeak * 1.45)
      );

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
        sourceName: "Mock Router",
        updatedAt: new Date().toISOString()
      };
    });
  }
}
