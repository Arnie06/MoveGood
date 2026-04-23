import { AppSettings, ScoreWeights, UserPreferences } from "@/lib/types/domain";

export const defaultWeights: ScoreWeights = {
  safety: 30,
  accessibility: 20,
  walk: 20,
  drive: 15,
  affordability: 0,
  homeFit: 0,
  lifestyle: 15
};

export const defaultAppSettings: AppSettings = {
  scoring: {
    confidenceThreshold: 55,
    strictMode: false,
    normalizationMode: "raw"
  },
  safety: {
    crimeRadiusMiles: 1,
    lookbackWindowDays: 365,
    categoryEmphasis: {
      violent: 1,
      property: 1,
      theft: 1
    },
    nightWeight: 1
  },
  travel: {
    walkSpeedProfile: "average",
    trafficProfile: "balanced",
    maxDestinationsRouted: 12,
    amenityWalkCaps: {
      grocery: 20,
      park: 20,
      coffee: 20,
      bar: 20
    }
  },
  mustHaves: {
    poiRules: {
      park: {
        enabled: true,
        requireWalk: true,
        maxWalkMinutes: 15,
        requireDrive: true,
        maxDriveMinutes: 8,
        enforceMinimumCount: true,
        minimumCount: 2,
        countRadiusMiles: 1
      },
      restaurant: {
        enabled: true,
        requireWalk: true,
        maxWalkMinutes: 15,
        requireDrive: true,
        maxDriveMinutes: 8,
        enforceMinimumCount: true,
        minimumCount: 4,
        countRadiusMiles: 1.5
      },
      bar: {
        enabled: true,
        requireWalk: true,
        maxWalkMinutes: 18,
        requireDrive: true,
        maxDriveMinutes: 10,
        enforceMinimumCount: true,
        minimumCount: 2,
        countRadiusMiles: 1.5
      },
      gym: {
        enabled: true,
        requireWalk: true,
        maxWalkMinutes: 20,
        requireDrive: true,
        maxDriveMinutes: 10,
        enforceMinimumCount: true,
        minimumCount: 2,
        countRadiusMiles: 2
      },
      coffee: {
        enabled: true,
        requireWalk: true,
        maxWalkMinutes: 12,
        requireDrive: true,
        maxDriveMinutes: 8,
        enforceMinimumCount: true,
        minimumCount: 3,
        countRadiusMiles: 1
      }
    },
    personalPlaces: {
      enabled: false,
      requireWalk: false,
      maxWalkMinutes: 35,
      requireDrive: true,
      maxDriveMinutes: 30,
      onlyIncludedInScoring: true
    }
  },
  dataReliability: {
    localOnlyMode: false,
    providerToggles: {
      geocoder: true,
      routing: true,
      poi: true,
      safety: true
    },
    cacheFreshness: "prefer-cached",
    showEstimatedData: true
  },
  mapBrowse: {
    defaultSearchArea: "Los Angeles, CA",
    defaultZoom: 11,
    defaultPoiCategories: ["grocery", "gym", "park", "restaurant", "coffee", "bar"],
    defaultCrimeOverlayOn: false,
    defaultCrimeDateFilter: "2y",
    autoRefreshOnViewportChange: true
  },
  ux: {
    explainabilityVerbosity: "detailed",
    distanceUnit: "mi",
    minuteDisplay: "compact",
    autoSaveComparisonSnapshots: true
  }
};

export const defaultPreferences: UserPreferences = {
  id: "demo-user",
  scoringWeights: defaultWeights,
  hardRules: [
    {
      id: "hr-work-peak",
      label: "Longest peak drive to any saved place within 45 minutes",
      metric: "work-peak-max",
      value: 45
    },
    {
      id: "hr-grocery-walk",
      label: "Grocery within 20 minutes walking",
      metric: "grocery-walk-max",
      value: 20
    },
    {
      id: "hr-safety",
      label: "Safety score at least 55",
      metric: "safety-min",
      value: 55
    }
  ],
  savedPlaces: [],
  settings: defaultAppSettings
};
