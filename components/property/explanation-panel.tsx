import { CheckCircle2, CircleAlert, Database } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AnalyzedLocation } from "@/lib/types/domain";

export function ExplanationPanel({
  item,
  compact = false
}: {
  item: AnalyzedLocation;
  compact?: boolean;
}) {
  return (
    <Card className="space-y-6 p-6">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
          Why this score
        </div>
        <h3 className="font-display text-2xl text-ink">What helped and what hurt</h3>
      </div>
      <div className={compact ? "space-y-6" : "grid gap-6 md:grid-cols-3"}>
        <div className={compact ? "border-b border-black/10 pb-5" : undefined}>
          <div className="mb-3 flex items-center gap-2 font-semibold text-moss">
            <CheckCircle2 className="h-5 w-5" />
            Helped
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            {item.score.highlights.length ? item.score.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            )) : <li>No standout positives surfaced for this location yet.</li>}
          </ul>
        </div>
        <div className={compact ? "border-b border-black/10 pb-5" : undefined}>
          <div className="mb-3 flex items-center gap-2 font-semibold text-clay">
            <CircleAlert className="h-5 w-5" />
            Tradeoffs
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            {item.score.tradeoffs.length ? item.score.tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            )) : <li>No major tradeoffs surfaced in the default demo preferences.</li>}
          </ul>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 font-semibold text-ocean">
            <Database className="h-5 w-5" />
            Data quality
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>Listings from: {item.sources.map((source) => source.sourceName).join(", ") || "Manual entry"}</li>
            <li>
              Safety source: {item.crimeMetrics[0]?.sourceName ?? "Unavailable"}
            </li>
            <li>
              Route source: {item.routeMetrics[0]?.sourceName ?? "Unavailable"}
            </li>
            {item.score.dataCompleteness.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
