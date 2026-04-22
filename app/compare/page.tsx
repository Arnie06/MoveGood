import { LocationCompareTable } from "@/components/location/location-compare-table";
import { SectionHeading } from "@/components/ui/section-heading";

export default function ComparePage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="Compare"
          title="Build your shortlist with a clear side-by-side view"
          description="Select saved locations, then compare scoring, nearby essentials, and travel time to each personal place. Missing route data is backfilled with distance-based estimates so rows stay populated."
        />
      </section>
      <LocationCompareTable />
    </div>
  );
}
