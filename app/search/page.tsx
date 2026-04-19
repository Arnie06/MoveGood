import { Suspense } from "react";

import Link from "next/link";

import { AmenitiesPanel } from "@/components/property/amenities-panel";
import { ExplanationPanel } from "@/components/property/explanation-panel";
import { PreferenceTravelPanel } from "@/components/property/preference-travel-panel";
import { RequirementsPanel } from "@/components/property/requirements-panel";
import { ScoreCard } from "@/components/property/score-card";
import { SearchBar } from "@/components/search/search-bar";
import { DemoMap } from "@/components/map/demo-map";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { analyzeLocation } from "@/lib/demo-service";
import { getServerPreferences } from "@/lib/server-preferences";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const parsed = {
    q: typeof resolved.q === "string" ? resolved.q : undefined
  };
  const preferences = await getServerPreferences();
  const analyzedLocation = parsed.q
    ? await analyzeLocation({
        address: parsed.q,
        preferences
      })
    : null;

  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell space-y-4 p-4 sm:p-6">
        <SectionHeading
          eyebrow="Location Search"
          title="Analyze any address, place, or neighborhood"
          description="Search for a location you care about and see nearby essentials, crime context, and travel times to all of your saved personal places."
        />
        <Suspense fallback={<div className="glass rounded-[28px] p-4 text-sm text-gray-500">Loading search controls…</div>}>
          <SearchBar defaultValue={parsed.q ?? ""} compact />
        </Suspense>
        <div className="flex flex-wrap gap-2">
          <Badge tone="good">
            Saved places are used in commute scoring
          </Badge>
          <Badge tone="default">
            Compare is based on analyzed locations, not listings
          </Badge>
        </div>
      </section>

      {analyzedLocation ? (
        <section className="space-y-6">
          <Card className="flex flex-wrap items-center gap-3 p-5">
            <Badge tone="good">Location analyzed</Badge>
            <Badge tone="muted">{analyzedLocation.property.canonicalAddress}</Badge>
            <Link
              href="/"
              className="inline-flex rounded-full bg-ocean px-4 py-2 text-sm font-medium text-white"
            >
              Open map browser to save or compare
            </Link>
          </Card>
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ScoreCard score={analyzedLocation.score} />
            <DemoMap items={[analyzedLocation]} selectedId={analyzedLocation.property.id} />
          </section>
          <ExplanationPanel item={analyzedLocation} />
          <PreferenceTravelPanel
            item={analyzedLocation}
            savedPlaces={preferences.savedPlaces.filter((place) => place.includeInScoring)}
          />
          <AmenitiesPanel item={analyzedLocation} />
          <RequirementsPanel score={analyzedLocation.score} />
        </section>
      ) : (
        <Card className="p-6 text-sm text-gray-600">
          Search an address or place above to analyze what is around it and how it connects to your saved personal places.
        </Card>
      )}
    </div>
  );
}
