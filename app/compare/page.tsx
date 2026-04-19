import { LocationCompareTable } from "@/components/location/location-compare-table";
import { SectionHeading } from "@/components/ui/section-heading";

export default function ComparePage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="Compare"
          title="See your saved locations side-by-side"
          description="Build a shortlist from the map browser, then compare scores, nearby access, and travel time to every saved personal place."
        />
      </section>
      <LocationCompareTable />
    </div>
  );
}
