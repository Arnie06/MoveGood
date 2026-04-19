import { PrismaClient } from "@prisma/client";

import { defaultPreferences } from "@/lib/constants";
import {
  mockAmenities,
  mockCrimeMetrics,
  mockProperties,
  mockRoutes,
  mockSourceRecords
} from "@/lib/data/mock-data";
import { computePropertyScore } from "@/lib/scoring";

const prisma = new PrismaClient();

async function main() {
  await prisma.propertyScore.deleteMany();
  await prisma.routeMetric.deleteMany();
  await prisma.listingSourceRecord.deleteMany();
  await prisma.property.deleteMany();
  await prisma.crimeMetric.deleteMany();
  await prisma.amenityPOI.deleteMany();
  await prisma.savedPlace.deleteMany();
  await prisma.userPreferences.deleteMany();

  await prisma.userPreferences.create({
    data: {
      id: defaultPreferences.id,
      budgetMin: null,
      budgetMax: null,
      minBeds: null,
      minBaths: null,
      minSqft: null,
      listingType: "all",
      propertyTypes: [],
      requiredAmenities: [],
      preferredAmenities: [],
      scoringWeights: defaultPreferences.scoringWeights,
      hardRules: defaultPreferences.hardRules,
      softPreferences: [],
      priorities: {},
      savedPlaces: {
        create: defaultPreferences.savedPlaces
      }
    }
  });

  await prisma.property.createMany({
    data: mockProperties.map((property) => ({
      ...property,
      amenities: property.amenities,
      images: property.images
    }))
  });

  await prisma.listingSourceRecord.createMany({ data: mockSourceRecords });
  await prisma.crimeMetric.createMany({ data: mockCrimeMetrics });
  await prisma.amenityPOI.createMany({ data: mockAmenities });
  await prisma.routeMetric.createMany({
    data: mockRoutes.map((route) => ({
      ...route,
      walkingMinutes: route.walkingMinutes ? Math.round(route.walkingMinutes) : null,
      driveMinutesOffPeak: route.driveMinutesOffPeak
        ? Math.round(route.driveMinutesOffPeak)
        : null,
      driveMinutesPeak: route.driveMinutesPeak ? Math.round(route.driveMinutesPeak) : null
    }))
  });

  for (const property of mockProperties) {
    const crimeMetrics = mockCrimeMetrics.filter((metric) => metric.geoId === property.id);
    const routeMetrics = mockRoutes.filter((route) => route.propertyId === property.id);
    const score = computePropertyScore({
      property,
      crimeMetrics,
      routeMetrics,
      nearbyAmenities: mockAmenities,
      preferences: defaultPreferences
    });

    await prisma.propertyScore.create({
      data: {
        id: `score-${property.id}`,
        propertyId: property.id,
        overallScore: score.overallScore,
        safetyScore: score.safetyScore,
        accessibilityScore: score.accessibilityScore,
        lifestyleScore: score.lifestyleScore,
        affordabilityScore: score.affordabilityScore,
        homeFitScore: score.homeFitScore,
        explanationJson: score,
        computedAt: new Date(score.computedAt)
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
