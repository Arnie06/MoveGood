import { ManualAddressForm } from "@/components/evaluate/manual-address-form";
import { DemoMap } from "@/components/map/demo-map";
import { AmenitiesPanel } from "@/components/property/amenities-panel";
import { ExplanationPanel } from "@/components/property/explanation-panel";
import { PreferenceTravelPanel } from "@/components/property/preference-travel-panel";
import { RequirementsPanel } from "@/components/property/requirements-panel";
import { ScoreCard } from "@/components/property/score-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { buildManualAddressContext } from "@/lib/demo-service";
import { buildManualPropertyHref } from "@/lib/manual-property";
import { getServerPreferences } from "@/lib/server-preferences";
import { AnalyzedLocation } from "@/lib/types/domain";

function toNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function EvaluatePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const address = typeof params.address === "string" ? params.address : "";
  const preferences = await getServerPreferences();

  let evaluation: AnalyzedLocation | null = null;

  if (address) {
    evaluation = await buildManualAddressContext({
      address,
      preferences,
      overrides: {
        price: toNumber(typeof params.price === "string" ? params.price : undefined),
        beds: toNumber(typeof params.beds === "string" ? params.beds : undefined),
        baths: toNumber(typeof params.baths === "string" ? params.baths : undefined),
        squareFeet: toNumber(typeof params.squareFeet === "string" ? params.squareFeet : undefined)
      }
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="Location Evaluation"
          title="Analyze a location with optional details you care about"
          description="Enter an address or place, optionally add details like budget, rooms, or space, and see the same proximity, safety, and saved-place travel analysis used across the app."
        />
      </section>

      <ManualAddressForm initialAddress={address} />

      {evaluation ? (
        <section className="space-y-6">
          <Card className="flex flex-wrap items-center gap-3 p-5">
            <Badge tone="good">Location analyzed</Badge>
            <Badge tone="muted">{evaluation.property.canonicalAddress}</Badge>
            <a
              href={buildManualPropertyHref(evaluation.property)}
              className="inline-flex rounded-full bg-ocean px-4 py-2 text-sm font-medium text-white"
            >
              Refresh this analysis with saved details
            </a>
          </Card>
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ScoreCard score={evaluation.score} />
            <DemoMap items={[evaluation]} selectedId={evaluation.property.id} />
          </section>
          <ExplanationPanel item={evaluation} />
          <PreferenceTravelPanel
            item={evaluation}
            savedPlaces={preferences.savedPlaces.filter((place) => place.includeInScoring)}
          />
          <AmenitiesPanel item={evaluation} />
          <RequirementsPanel score={evaluation.score} />
        </section>
      ) : (
        <Card className="p-6 text-sm text-gray-600">
          Enter an address or place above to generate a location analysis with optional custom details.
        </Card>
      )}
    </div>
  );
}
