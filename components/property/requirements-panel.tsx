import { Card } from "@/components/ui/card";
import { LocationScore } from "@/lib/types/domain";
import { CheckCircle2, XCircle } from "lucide-react";

export function RequirementsPanel({ score }: { score: LocationScore }) {
  const total = score.requirementResults.length;
  const passed = score.requirementResults.filter((result) => result.passed).length;

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
          Must-Haves
        </div>
        <h3 className="font-display text-2xl text-ink">Passes and misses</h3>
        </div>
        {total > 0 ? (
          <div className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
            {passed}/{total} passing
          </div>
        ) : null}
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
                ? "border-moss/35 bg-moss/12"
                : "border-clay/35 bg-clay/12"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {result.passed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-moss" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-clay" />
                )}
                <div>
                  <div className="font-semibold text-ink">{result.label}</div>
                  <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2 sm:gap-3">
                    <div>
                      <div className="uppercase tracking-[0.12em] text-gray-500">Observed</div>
                      <div className="font-medium text-ink">{String(result.actual ?? "N/A")}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-[0.12em] text-gray-500">Requirement</div>
                      <div className="font-medium text-ink">{String(result.target)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  result.passed
                    ? "bg-moss/20 text-moss"
                    : "bg-clay/20 text-clay"
                }`}
              >
                {result.passed ? "Pass" : "Fail"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
