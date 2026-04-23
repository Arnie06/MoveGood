import { MustHavesManager } from "@/components/preferences/must-haves-manager";
import { SavedPlacesManager } from "@/components/preferences/saved-places-manager";
import { SectionHeading } from "@/components/ui/section-heading";

export default function MyPreferencesPage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="My Preferences"
          title="Set your places and must-haves in one flow"
          description="Add the places that matter to you, then define exactly what nearby amenities are required. Analysis and compare will use these preferences immediately."
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <SavedPlacesManager />
        <MustHavesManager />
      </section>
    </div>
  );
}
