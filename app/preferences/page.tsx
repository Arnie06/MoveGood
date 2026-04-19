import { SavedPlacesManager } from "@/components/preferences/saved-places-manager";
import { SectionHeading } from "@/components/ui/section-heading";

export default function PreferencesPage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="Saved Places"
          title="Manage the places that define your day-to-day geography"
          description="Saved places are stored locally and used for travel-time analysis, scoring, and side-by-side location comparison."
        />
      </section>
      <SavedPlacesManager />
    </div>
  );
}
