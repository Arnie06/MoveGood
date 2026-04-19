import {
  AmenityPOI,
  CrimeMetric,
  ListingSourceRecord,
  Property,
  RouteMetric
} from "@/lib/types/domain";

const now = "2026-04-18T12:00:00.000Z";

export const mockProperties: Property[] = [
  {
    id: "prop-park-slope-loft",
    canonicalAddress: "315 7th Ave, Brooklyn, NY 11215",
    city: "Brooklyn",
    state: "NY",
    zipCode: "11215",
    neighborhood: "Park Slope",
    lat: 40.6684,
    lng: -73.9802,
    propertyType: "apartment",
    listingType: "rent",
    beds: 2,
    baths: 1.5,
    squareFeet: 980,
    price: 3150,
    hoa: 0,
    amenities: ["laundry", "dishwasher", "pet-friendly"],
    images: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Bright corner apartment near Prospect Park with easy grocery access.",
    providerKeys: ["mock-zillow", "mock-realtor"],
    sourceSummary: "Mock Zillow + Mock Realtor",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "prop-astoria-sunlit",
    canonicalAddress: "24-18 31st St, Astoria, NY 11102",
    city: "Queens",
    state: "NY",
    zipCode: "11102",
    neighborhood: "Astoria",
    lat: 40.7728,
    lng: -73.924,
    propertyType: "condo",
    listingType: "sale",
    beds: 1,
    baths: 1,
    squareFeet: 760,
    price: 645000,
    amenities: ["gym", "laundry", "doorman"],
    images: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Modern condo with skyline views and strong coffee shop density.",
    providerKeys: ["mock-redfin"],
    sourceSummary: "Mock Redfin",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "prop-hoboken-brownstone",
    canonicalAddress: "412 Garden St, Hoboken, NJ 07030",
    city: "Hoboken",
    state: "NJ",
    zipCode: "07030",
    neighborhood: "Northwest Hoboken",
    lat: 40.7486,
    lng: -74.0324,
    propertyType: "townhome",
    listingType: "rent",
    beds: 3,
    baths: 2,
    squareFeet: 1450,
    price: 4950,
    amenities: ["parking", "laundry", "pet-friendly", "backyard"],
    images: [
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Townhome rental with space, parks, and a manageable Midtown commute.",
    providerKeys: ["mock-zillow"],
    sourceSummary: "Mock Zillow",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "prop-jersey-city-starter",
    canonicalAddress: "99 Bright St, Jersey City, NJ 07302",
    city: "Jersey City",
    state: "NJ",
    zipCode: "07302",
    neighborhood: "Downtown",
    lat: 40.7179,
    lng: -74.0433,
    propertyType: "apartment",
    listingType: "sale",
    beds: 2,
    baths: 2,
    squareFeet: 1035,
    price: 719000,
    amenities: ["gym", "roofdeck", "laundry"],
    images: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Well-located condo with strong transit access and balanced lifestyle options.",
    providerKeys: ["mock-redfin", "mock-realtor"],
    sourceSummary: "Mock Redfin + Mock Realtor",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "prop-upper-east-studio",
    canonicalAddress: "420 E 79th St, New York, NY 10075",
    city: "New York",
    state: "NY",
    zipCode: "10075",
    neighborhood: "Upper East Side",
    lat: 40.7731,
    lng: -73.9547,
    propertyType: "studio",
    listingType: "rent",
    beds: 0,
    baths: 1,
    squareFeet: 520,
    price: 2795,
    amenities: ["doorman", "laundry"],
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Compact studio in a polished, safer-feeling neighborhood with good essentials access.",
    providerKeys: ["mock-zillow"],
    sourceSummary: "Mock Zillow",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "prop-clinton-hill-manual",
    canonicalAddress: "65 Greene Ave, Brooklyn, NY 11238",
    city: "Brooklyn",
    state: "NY",
    zipCode: "11238",
    neighborhood: "Clinton Hill",
    lat: 40.6878,
    lng: -73.9682,
    propertyType: "house",
    listingType: "manual",
    beds: 2,
    baths: 1,
    squareFeet: 1200,
    price: 3800,
    amenities: ["laundry", "dishwasher"],
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80"
    ],
    description: "Manual evaluation address for demo mode with editable details.",
    providerKeys: ["manual"],
    sourceSummary: "Manual address evaluation",
    createdAt: now,
    updatedAt: now
  }
];

export const mockSourceRecords: ListingSourceRecord[] = [
  {
    id: "src-1",
    propertyId: "prop-park-slope-loft",
    sourceName: "Mock Zillow",
    sourceListingId: "z-11215-001",
    sourceUrl: "https://example.com/zillow/park-slope",
    rawPayload: { confidence: "high" },
    price: 3150,
    beds: 2,
    baths: 1.5,
    squareFeet: 980,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-2",
    propertyId: "prop-park-slope-loft",
    sourceName: "Mock Realtor",
    sourceListingId: "r-11215-009",
    sourceUrl: "https://example.com/realtor/park-slope",
    rawPayload: { confidence: "high" },
    price: 3175,
    beds: 2,
    baths: 1.5,
    squareFeet: 975,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-3",
    propertyId: "prop-astoria-sunlit",
    sourceName: "Mock Redfin",
    sourceListingId: "rf-11102-100",
    sourceUrl: "https://example.com/redfin/astoria",
    rawPayload: { confidence: "medium" },
    price: 645000,
    beds: 1,
    baths: 1,
    squareFeet: 760,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-4",
    propertyId: "prop-hoboken-brownstone",
    sourceName: "Mock Zillow",
    sourceListingId: "z-07030-301",
    sourceUrl: "https://example.com/zillow/hoboken",
    rawPayload: { confidence: "high" },
    price: 4950,
    beds: 3,
    baths: 2,
    squareFeet: 1450,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-5",
    propertyId: "prop-jersey-city-starter",
    sourceName: "Mock Redfin",
    sourceListingId: "rf-07302-220",
    sourceUrl: "https://example.com/redfin/jersey-city",
    rawPayload: { confidence: "medium" },
    price: 719000,
    beds: 2,
    baths: 2,
    squareFeet: 1035,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-6",
    propertyId: "prop-jersey-city-starter",
    sourceName: "Mock Realtor",
    sourceListingId: "r-07302-710",
    sourceUrl: "https://example.com/realtor/jersey-city",
    rawPayload: { confidence: "medium" },
    price: 725000,
    beds: 2,
    baths: 2,
    squareFeet: 1020,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  },
  {
    id: "src-7",
    propertyId: "prop-upper-east-studio",
    sourceName: "Mock Zillow",
    sourceListingId: "z-10075-030",
    sourceUrl: "https://example.com/zillow/ues",
    rawPayload: { confidence: "high" },
    price: 2795,
    beds: 0,
    baths: 1,
    squareFeet: 520,
    status: "active",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    lastSeenAt: now
  }
];

export const mockCrimeMetrics: CrimeMetric[] = [
  {
    id: "crime-park-slope-overall",
    geoId: "prop-park-slope-loft",
    lat: 40.6684,
    lng: -73.9802,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 17,
    normalizedScore: 79,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "Safer than nearby Brooklyn average",
    effectiveDate: now
  },
  {
    id: "crime-astoria-overall",
    geoId: "prop-astoria-sunlit",
    lat: 40.7728,
    lng: -73.924,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 24,
    normalizedScore: 70,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "Around neighborhood average",
    effectiveDate: now
  },
  {
    id: "crime-hoboken-overall",
    geoId: "prop-hoboken-brownstone",
    lat: 40.7486,
    lng: -74.0324,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 12,
    normalizedScore: 84,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "Strong safety profile nearby",
    effectiveDate: now
  },
  {
    id: "crime-jersey-city-overall",
    geoId: "prop-jersey-city-starter",
    lat: 40.7179,
    lng: -74.0433,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 22,
    normalizedScore: 73,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "Slightly safer than downtown average",
    effectiveDate: now
  },
  {
    id: "crime-ues-overall",
    geoId: "prop-upper-east-studio",
    lat: 40.7731,
    lng: -73.9547,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 14,
    normalizedScore: 82,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "Strong safety profile nearby",
    effectiveDate: now
  },
  {
    id: "crime-clinton-hill-overall",
    geoId: "prop-clinton-hill-manual",
    lat: 40.6878,
    lng: -73.9682,
    radiusMiles: 0.6,
    metricType: "overall",
    value: 25,
    normalizedScore: 68,
    sourceName: "Mock Safety Grid",
    comparisonLabel: "A bit below nearby top options",
    effectiveDate: now
  }
];

export const mockAmenities: AmenityPOI[] = [
  { id: "poi-1", name: "Union Market", category: "grocery", lat: 40.6695, lng: -73.9793, address: "Brooklyn, NY" },
  { id: "poi-2", name: "Prospect Park", category: "park", lat: 40.6602, lng: -73.969, address: "Brooklyn, NY" },
  { id: "poi-3", name: "Slope Brew", category: "coffee", lat: 40.6675, lng: -73.9819, address: "Brooklyn, NY" },
  { id: "poi-4", name: "Form + Flow", category: "gym", lat: 40.6668, lng: -73.9781, address: "Brooklyn, NY" },
  { id: "poi-5", name: "Astoria Park", category: "park", lat: 40.7795, lng: -73.9225, address: "Queens, NY" },
  { id: "poi-6", name: "Kinship Coffee", category: "coffee", lat: 40.7712, lng: -73.9254, address: "Queens, NY" },
  { id: "poi-7", name: "Greenbay Market", category: "grocery", lat: 40.7736, lng: -73.923, address: "Queens, NY" },
  { id: "poi-8", name: "Northwest Resilience Gym", category: "gym", lat: 40.7481, lng: -74.0316, address: "Hoboken, NJ" },
  { id: "poi-9", name: "ShopRite Hoboken", category: "grocery", lat: 40.7471, lng: -74.0301, address: "Hoboken, NJ" },
  { id: "poi-10", name: "Columbus Park", category: "park", lat: 40.7463, lng: -74.032, address: "Hoboken, NJ" },
  { id: "poi-11", name: "Downtown Bean", category: "coffee", lat: 40.7189, lng: -74.0412, address: "Jersey City, NJ" },
  { id: "poi-12", name: "Whole Foods Jersey City", category: "grocery", lat: 40.7197, lng: -74.0396, address: "Jersey City, NJ" },
  { id: "poi-13", name: "Van Vorst Park", category: "park", lat: 40.7194, lng: -74.046, address: "Jersey City, NJ" },
  { id: "poi-14", name: "East River Fitness", category: "gym", lat: 40.7727, lng: -73.9561, address: "New York, NY" },
  { id: "poi-15", name: "Agata & Valentina", category: "grocery", lat: 40.7742, lng: -73.956, address: "New York, NY" },
  { id: "poi-16", name: "Carl Schurz Park", category: "park", lat: 40.7757, lng: -73.943, address: "New York, NY" },
  { id: "poi-17", name: "Birdsong Coffee", category: "coffee", lat: 40.6882, lng: -73.9665, address: "Brooklyn, NY" },
  { id: "poi-18", name: "Greene Grape", category: "grocery", lat: 40.6871, lng: -73.9698, address: "Brooklyn, NY" },
  { id: "poi-19", name: "Fort Greene Park", category: "park", lat: 40.6925, lng: -73.9756, address: "Brooklyn, NY" },
  { id: "poi-20", name: "Late Night Social", category: "bar", lat: 40.7192, lng: -74.0404, address: "Jersey City, NJ" }
];

export const mockRoutes: RouteMetric[] = [
  { id: "route-1", propertyId: "prop-park-slope-loft", destinationType: "grocery", destinationId: "poi-1", destinationLabel: "Union Market", walkingMinutes: 6, driveMinutesOffPeak: 4, driveMinutesPeak: 7, sourceName: "Mock Router", updatedAt: now },
  { id: "route-2", propertyId: "prop-park-slope-loft", destinationType: "park", destinationId: "poi-2", destinationLabel: "Prospect Park", walkingMinutes: 9, driveMinutesOffPeak: 5, driveMinutesPeak: 8, sourceName: "Mock Router", updatedAt: now },
  { id: "route-3", propertyId: "prop-park-slope-loft", destinationType: "coffee", destinationId: "poi-3", destinationLabel: "Slope Brew", walkingMinutes: 4, driveMinutesOffPeak: 3, driveMinutesPeak: 6, sourceName: "Mock Router", updatedAt: now },
  { id: "route-4", propertyId: "prop-park-slope-loft", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 21, driveMinutesPeak: 34, sourceName: "Mock Router", updatedAt: now },
  { id: "route-5", propertyId: "prop-astoria-sunlit", destinationType: "grocery", destinationId: "poi-7", destinationLabel: "Greenbay Market", walkingMinutes: 8, driveMinutesOffPeak: 5, driveMinutesPeak: 8, sourceName: "Mock Router", updatedAt: now },
  { id: "route-6", propertyId: "prop-astoria-sunlit", destinationType: "park", destinationId: "poi-5", destinationLabel: "Astoria Park", walkingMinutes: 11, driveMinutesOffPeak: 6, driveMinutesPeak: 10, sourceName: "Mock Router", updatedAt: now },
  { id: "route-7", propertyId: "prop-astoria-sunlit", destinationType: "coffee", destinationId: "poi-6", destinationLabel: "Kinship Coffee", walkingMinutes: 5, driveMinutesOffPeak: 4, driveMinutesPeak: 7, sourceName: "Mock Router", updatedAt: now },
  { id: "route-8", propertyId: "prop-astoria-sunlit", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 18, driveMinutesPeak: 29, sourceName: "Mock Router", updatedAt: now },
  { id: "route-9", propertyId: "prop-hoboken-brownstone", destinationType: "grocery", destinationId: "poi-9", destinationLabel: "ShopRite Hoboken", walkingMinutes: 7, driveMinutesOffPeak: 4, driveMinutesPeak: 6, sourceName: "Mock Router", updatedAt: now },
  { id: "route-10", propertyId: "prop-hoboken-brownstone", destinationType: "park", destinationId: "poi-10", destinationLabel: "Columbus Park", walkingMinutes: 6, driveMinutesOffPeak: 3, driveMinutesPeak: 5, sourceName: "Mock Router", updatedAt: now },
  { id: "route-11", propertyId: "prop-hoboken-brownstone", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 15, driveMinutesPeak: 23, sourceName: "Mock Router", updatedAt: now },
  { id: "route-12", propertyId: "prop-jersey-city-starter", destinationType: "grocery", destinationId: "poi-12", destinationLabel: "Whole Foods Jersey City", walkingMinutes: 5, driveMinutesOffPeak: 3, driveMinutesPeak: 5, sourceName: "Mock Router", updatedAt: now },
  { id: "route-13", propertyId: "prop-jersey-city-starter", destinationType: "park", destinationId: "poi-13", destinationLabel: "Van Vorst Park", walkingMinutes: 8, driveMinutesOffPeak: 4, driveMinutesPeak: 7, sourceName: "Mock Router", updatedAt: now },
  { id: "route-14", propertyId: "prop-jersey-city-starter", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 19, driveMinutesPeak: 31, sourceName: "Mock Router", updatedAt: now },
  { id: "route-15", propertyId: "prop-upper-east-studio", destinationType: "grocery", destinationId: "poi-15", destinationLabel: "Agata & Valentina", walkingMinutes: 7, driveMinutesOffPeak: 3, driveMinutesPeak: 7, sourceName: "Mock Router", updatedAt: now },
  { id: "route-16", propertyId: "prop-upper-east-studio", destinationType: "park", destinationId: "poi-16", destinationLabel: "Carl Schurz Park", walkingMinutes: 12, driveMinutesOffPeak: 6, driveMinutesPeak: 11, sourceName: "Mock Router", updatedAt: now },
  { id: "route-17", propertyId: "prop-upper-east-studio", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 11, driveMinutesPeak: 18, sourceName: "Mock Router", updatedAt: now },
  { id: "route-18", propertyId: "prop-clinton-hill-manual", destinationType: "grocery", destinationId: "poi-18", destinationLabel: "Greene Grape", walkingMinutes: 9, driveMinutesOffPeak: 5, driveMinutesPeak: 8, sourceName: "Mock Router", updatedAt: now },
  { id: "route-19", propertyId: "prop-clinton-hill-manual", destinationType: "park", destinationId: "poi-19", destinationLabel: "Fort Greene Park", walkingMinutes: 14, driveMinutesOffPeak: 7, driveMinutesPeak: 11, sourceName: "Mock Router", updatedAt: now },
  { id: "route-20", propertyId: "prop-clinton-hill-manual", destinationType: "saved-place", destinationId: "saved-work", destinationLabel: "Work", walkingMinutes: undefined, driveMinutesOffPeak: 24, driveMinutesPeak: 36, sourceName: "Mock Router", updatedAt: now }
];
