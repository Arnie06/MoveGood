import { SavedPlacesManager } from "@/components/preferences/saved-places-manager";
import { SectionHeading } from "@/components/ui/section-heading";

export default function MyPlacesPage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="My Places"
          title="Manage personal places used across scoring and travel"
          description="Add or edit home, work, school, family, and other frequent destinations so analysis and compare views can evaluate commute and access tradeoffs."
        />
      </section>
      <SavedPlacesManager />
    </div>
  );
}
