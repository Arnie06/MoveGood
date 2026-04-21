import { PreferencesTabs } from "@/components/preferences/preferences-tabs";
import { SectionHeading } from "@/components/ui/section-heading";

export default function PreferencesPage() {
  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-6 sm:p-8">
        <SectionHeading
          eyebrow="Preferences"
          title="Tune scoring, safety, travel, data, map, and UX behavior"
          description="These settings are stored locally and control how locations are evaluated and displayed. Ranking settings are intentionally excluded for now."
        />
      </section>
      <PreferencesTabs />
    </div>
  );
}
