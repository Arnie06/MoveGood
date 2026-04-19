import {
  AddressSuggestion,
  AmenityPOI,
  CrimeIncident,
  CrimeMetric,
  GeocodedLocation,
  RouteMetric,
  SavedPlace
} from "@/lib/types/domain";

export interface GeocoderProvider {
  name: string;
  geocode(address: string): Promise<GeocodedLocation | null>;
  reverseGeocode(input: { lat: number; lng: number }): Promise<GeocodedLocation | null>;
  autocomplete(query: string, limit?: number): Promise<AddressSuggestion[]>;
}

export interface RoutingProvider {
  name: string;
  getRouteMetrics(input: {
    propertyId: string;
    propertyLat: number;
    propertyLng: number;
    destinations: Array<SavedPlace | AmenityPOI>;
    includeTraffic?: boolean;
  }): Promise<RouteMetric[]>;
}

export interface PoiProvider {
  name: string;
  getNearbyAmenities(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
    categories?: AmenityPOI["category"][];
  }): Promise<AmenityPOI[]>;
}

export interface SafetyProvider {
  name: string;
  getSafetyMetrics(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
  }): Promise<CrimeMetric[]>;
  getCrimeIncidents(input: {
    lat: number;
    lng: number;
    radiusMiles: number;
  }): Promise<CrimeIncident[]>;
}
