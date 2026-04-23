"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Card } from "@/components/ui/card";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { Input } from "@/components/ui/input";
import { defaultAppSettings } from "@/lib/constants";

const categories = ["park", "restaurant", "bar", "gym", "coffee"] as const;

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTitle(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function HelpTip({ text }: { text: string }) {
  return (
    <HoverTooltip content={text}>
      <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-black/10 text-[11px] font-semibold text-gray-500">
        ?
      </span>
    </HoverTooltip>
  );
}

export function MustHavesManager() {
  const { preferences, setPreferences } = usePreferences();
  const settings = preferences.settings ?? defaultAppSettings;

  const enabledCount = categories.filter((category) => settings.mustHaves.poiRules[category].enabled).length;

  function updateRule(
    category: (typeof categories)[number],
    updater: (current: (typeof settings.mustHaves.poiRules)[typeof category]) => (typeof settings.mustHaves.poiRules)[typeof category]
  ) {
    const current = settings.mustHaves.poiRules[category];
    const nextRule = updater(current);

    setPreferences({
      ...preferences,
      settings: {
        ...settings,
        mustHaves: {
          ...settings.mustHaves,
          poiRules: {
            ...settings.mustHaves.poiRules,
            [category]: nextRule
          }
        }
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl text-ink">Must-haves</h3>
          <p className="mt-2 text-sm text-gray-600">
            Define what must be nearby for each category. Use walk-only, drive-only, or either.
          </p>
        </div>
        <div className="rounded-full bg-ocean/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">
          {enabledCount}/{categories.length} enabled
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const rule = settings.mustHaves.poiRules[category];
          return (
            <div key={category} className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        enabled: event.target.checked
                      }))
                    }
                  />
                  {toTitle(category)}
                </label>
                <div className="text-xs text-gray-500">
                  {rule.requireWalk && rule.requireDrive
                    ? "Pass if walk or drive meets threshold"
                    : rule.requireWalk
                    ? "Walk-only requirement"
                    : rule.requireDrive
                    ? "Drive-only requirement"
                    : "No time requirement"}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rule.requireWalk}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        requireWalk: event.target.checked
                      }))
                    }
                  />
                  Require walk
                </label>
                <label className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Max walk (min)</span>
                    <HelpTip text="Nearest matching place must be reachable within this many walking minutes." />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={rule.maxWalkMinutes}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        maxWalkMinutes: toNumber(event.target.value, current.maxWalkMinutes)
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rule.requireDrive}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        requireDrive: event.target.checked
                      }))
                    }
                  />
                  Require drive
                </label>
                <label className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Max drive (min)</span>
                    <HelpTip text="Nearest matching place must be reachable within this many driving minutes." />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={rule.maxDriveMinutes}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        maxDriveMinutes: toNumber(event.target.value, current.maxDriveMinutes)
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rule.enforceMinimumCount}
                    onChange={(event) =>
                      updateRule(category, (current) => ({
                        ...current,
                        enforceMinimumCount: event.target.checked
                      }))
                    }
                  />
                  Require minimum count
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="text-sm text-gray-600">Count</div>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={rule.minimumCount}
                      onChange={(event) =>
                        updateRule(category, (current) => ({
                          ...current,
                          minimumCount: toNumber(event.target.value, current.minimumCount)
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-sm text-gray-600">Radius (mi)</div>
                    <Input
                      type="number"
                      min={0.1}
                      max={10}
                      step="0.1"
                      value={rule.countRadiusMiles}
                      onChange={(event) =>
                        updateRule(category, (current) => ({
                          ...current,
                          countRadiusMiles: toNumber(event.target.value, current.countRadiusMiles)
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
