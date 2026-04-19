export type ListingType = "rent" | "sale" | "manual";

export type PropertyType =
  | "apartment"
  | "condo"
  | "house"
  | "townhome"
  | "duplex"
  | "studio";

export type AmenityCategory =
  | "grocery"
  | "gym"
  | "park"
  | "restaurant"
  | "coffee"
  | "bar"
  | "transit"
  | "school"
  | "doctor"
  | "major-poi"
  | "custom";

export type DataMode = "demo" | "live" | "hybrid";

export type SafetyMetricType =
  | "overall"
  | "violent"
  | "property"
  | "theft"
  | "night-comfort";

export type CrimeIncidentCategory =
  | "violent"
  | "property"
  | "theft"
  | "vehicle"
  | "other";

export interface Property {
  id: string;
  canonicalAddress: string;
  city: string;
  state: string;
  zipCode: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  propertyType: PropertyType;
  listingType: ListingType;
  beds?: number;
  baths?: number;
  squareFeet?: number;
  price?: number;
  hoa?: number;
  amenities: string[];
  images: string[];
  description?: string;
  providerKeys: string[];
  sourceSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSourceRecord {
  id: string;
  propertyId: string;
  sourceName: string;
  sourceListingId: string;
  sourceUrl: string;
  rawPayload: Record<string, unknown>;
  price?: number;
  beds?: number;
  baths?: number;
  squareFeet?: number;
  status: "active" | "pending" | "off-market";
  thumbnailUrl?: string;
  lastSeenAt: string;
}

export interface CrimeMetric {
  id: string;
  geoId: string;
  lat: number;
  lng: number;
  radiusMiles?: number;
  metricType: SafetyMetricType;
  value: number;
  normalizedScore: number;
  sourceName: string;
  comparisonLabel?: string;
  effectiveDate: string;
}

export interface CrimeIncident {
  id: string;
  geoId: string;
  lat: number;
  lng: number;
  category: CrimeIncidentCategory;
  label: string;
  blockAddress?: string;
  occurredAt: string;
  sourceName: string;
  metadata?: Record<string, unknown>;
}

export interface AmenityPOI {
  id: string;
  name: string;
  category: AmenityCategory;
  lat: number;
  lng: number;
  address: string;
  metadata?: Record<string, unknown>;
}

export interface RouteMetric {
  id: string;
  propertyId: string;
  destinationType: AmenityCategory | "saved-place";
  destinationId: string;
  destinationLabel: string;
  walkingMinutes?: number;
  driveMinutesOffPeak?: number;
  driveMinutesPeak?: number;
  sourceName: string;
  updatedAt: string;
}

export interface SavedPlace {
  id: string;
  label: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  includeInScoring: boolean;
}

export interface GeocodedLocation {
  canonicalAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  zipCode: string;
}

export interface AddressSuggestion extends GeocodedLocation {
  label: string;
}

export interface ScoreWeights {
  safety: number;
  accessibility: number;
  affordability: number;
  homeFit: number;
  lifestyle: number;
}

export interface HardRule {
  id: string;
  label: string;
  metric:
    | "price-max"
    | "safety-min"
    | "work-peak-max"
    | "grocery-walk-max"
    | "parks-count-min"
    | "beds-min"
    | "baths-min";
  value: number;
}

export interface UserPreferences {
  id: string;
  scoringWeights: ScoreWeights;
  hardRules: HardRule[];
  savedPlaces: SavedPlace[];
}

export interface RequirementResult {
  ruleId: string;
  label: string;
  passed: boolean;
  actual?: number | string;
  target: number;
}

export interface PropertyScore {
  propertyId: string;
  overallScore: number;
  safetyScore: number;
  accessibilityScore: number;
  lifestyleScore: number;
  affordabilityScore: number;
  homeFitScore: number;
  explanations: {
    overall: string;
    safety: string;
    accessibility: string;
    lifestyle: string;
  };
  highlights: string[];
  tradeoffs: string[];
  failedMustHaves: string[];
  requirementResults: RequirementResult[];
  dataCompleteness: string[];
  computedAt: string;
}

export interface PropertyWithContext {
  property: Property;
  sources: ListingSourceRecord[];
  crimeMetrics: CrimeMetric[];
  crimeIncidents: CrimeIncident[];
  nearbyAmenities: AmenityPOI[];
  routeMetrics: RouteMetric[];
  score: PropertyScore;
}

export type LocationProfile = Property;
export type LocationScore = PropertyScore;
export type AnalyzedLocation = PropertyWithContext;

export interface SavedAnalyzedLocation {
  id: string;
  name: string;
  canonicalAddress: string;
  lat: number;
  lng: number;
  analysis: AnalyzedLocation;
  createdAt: string;
}

export interface SearchLocationContext {
  canonicalAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  zipCode: string;
  crimeMetrics: CrimeMetric[];
  crimeIncidents: CrimeIncident[];
  nearbyAmenities: AmenityPOI[];
}
