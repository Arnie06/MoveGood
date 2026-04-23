import { Card } from "@/components/ui/card";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { LocationScore } from "@/lib/types/domain";

export function ScoreCard({ score }: { score: LocationScore }) {
  const rows: Array<[string, number, string]> = [
    ["Overall MoveGood Score", score.overallScore, score.explanations.overall],
    ["Confidence", score.confidenceScore, "Confidence reflects how complete and grounded the underlying data is for this location."],
    ["Safety", score.safetyScore, score.explanations.safety],
    ["Accessibility", score.accessibilityScore, score.explanations.accessibility],
    ["Lifestyle", score.lifestyleScore, score.explanations.lifestyle],
    ["Walk", score.walkScore, score.explanations.walk],
    ["Drive", score.driveScore, score.explanations.drive]
  ];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
            Score Breakdown
          </div>
          <h3 className="font-display text-2xl text-ink">Explainable, not mysterious</h3>
        </div>
        <div className="rounded-3xl bg-ocean px-5 py-4 text-center text-white">
          <div className="text-3xl font-bold">{score.overallScore}</div>
          <div className="text-xs uppercase tracking-[0.2em]">Overall</div>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value, explanation]) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <HoverTooltip content={explanation}>
                <span className="cursor-help text-gray-600">{label}</span>
              </HoverTooltip>
              <span className="font-semibold text-ink">{value}</span>
            </div>
            <div className="h-2 rounded-full bg-black/5">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-clay to-ocean"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
