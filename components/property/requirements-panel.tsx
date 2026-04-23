import { Card } from "@/components/ui/card";
import { LocationScore } from "@/lib/types/domain";

export function RequirementsPanel({ score }: { score: LocationScore }) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
          Must-Haves
        </div>
        <h3 className="font-display text-2xl text-ink">Passes and misses</h3>
      </div>
      <div className="space-y-3">
        {score.requirementResults.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-gray-600">
            No must-haves configured yet. Open Settings to define walk/drive and count requirements.
          </div>
        ) : score.requirementResults.map((result) => (
          <div
            key={result.ruleId}
            className={`rounded-2xl border p-4 ${
              result.passed
                ? "border-moss/20 bg-moss/10"
                : "border-clay/20 bg-clay/10"
            }`}
          >
            <div className="font-medium text-ink">{result.label}</div>
            <div className="text-sm text-gray-600">
              {result.passed ? "Pass" : "Miss"} • observed {String(result.actual)} • requirement {String(result.target)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
