"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
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
  const personalPlaceRules = settings.mustHaves.personalPlaces;

  const enabledCount = categories.filter((category) => settings.mustHaves.poiRules[category].enabled).length;
  const timeEnabledCount = categories.filter((category) => {
    const rule = settings.mustHaves.poiRules[category];
    return rule.enabled && (rule.requireWalk || rule.requireDrive);
  }).length;
  const countEnabledCount = categories.filter((category) => {
    const rule = settings.mustHaves.poiRules[category];
    return rule.enabled && rule.enforceMinimumCount;
  }).length;

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

  function updatePersonalPlaceRules(
    updater: (current: typeof settings.mustHaves.personalPlaces) => typeof settings.mustHaves.personalPlaces
  ) {
    const nextRules = updater(settings.mustHaves.personalPlaces);
    setPreferences({
      ...preferences,
      settings: {
        ...settings,
        mustHaves: {
          ...settings.mustHaves,
          personalPlaces: nextRules
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
            Set hard constraints for nearby amenities and personal-place commute times. These checks drive pass/fail results.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="default">{enabledCount}/{categories.length} POI categories on</Badge>
            <Badge tone="muted">{timeEnabledCount} with time checks</Badge>
            <Badge tone="muted">{countEnabledCount} with count checks</Badge>
            <Badge tone={personalPlaceRules.enabled ? "good" : "warn"}>
              Personal-place commute {personalPlaceRules.enabled ? "on" : "off"}
            </Badge>
          </div>
        </div>
        <div className="rounded-full bg-ocean/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">
          {enabledCount}/{categories.length} enabled
        </div>
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
        Nearby Amenities
      </div>
      <div className="space-y-4">
        {categories.map((category) => {
          const rule = settings.mustHaves.poiRules[category];
          const effectiveLogic =
            rule.requireWalk && rule.requireDrive
              ? "Passes if either walk or drive threshold is met."
              : rule.requireWalk
              ? "Passes only if walk threshold is met."
              : rule.requireDrive
              ? "Passes only if drive threshold is met."
              : "No time requirement active.";
          return (
            <div
              key={category}
              className={`rounded-2xl border p-4 shadow-sm transition ${
                rule.enabled
                  ? "border-black/10 bg-white/80"
                  : "border-black/10 bg-black/[0.03]"
              }`}
            >
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
                <Badge tone={rule.enabled ? "good" : "warn"}>
                  {rule.enabled ? "Active" : "Off"}
                </Badge>
              </div>
              <div className="mb-3 text-xs text-gray-500">{effectiveLogic}</div>

              <div className={`grid gap-3 md:grid-cols-2 ${rule.enabled ? "" : "opacity-65"}`}>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    disabled={!rule.enabled}
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
                    disabled={!rule.enabled || !rule.requireWalk}
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
                    disabled={!rule.enabled}
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
                    disabled={!rule.enabled || !rule.requireDrive}
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
                    disabled={!rule.enabled}
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
                      disabled={!rule.enabled || !rule.enforceMinimumCount}
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
                      disabled={!rule.enabled || !rule.enforceMinimumCount}
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

      <div className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
        Personal Places
      </div>
      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={personalPlaceRules.enabled}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
                  ...current,
                  enabled: event.target.checked
                }))
              }
            />
            Personal places commute checks
          </label>
          <Badge tone={personalPlaceRules.enabled ? "good" : "warn"}>
            {personalPlaceRules.enabled ? "Active" : "Off"}
          </Badge>
        </div>
        <div className="mb-3 text-xs text-gray-500">
          {personalPlaceRules.requireWalk && personalPlaceRules.requireDrive
            ? "Each selected personal place passes if walk or drive threshold is met."
            : personalPlaceRules.requireWalk
            ? "Each selected personal place must satisfy the walk threshold."
            : personalPlaceRules.requireDrive
            ? "Each selected personal place must satisfy the drive threshold."
            : "No time requirement active."}
        </div>
        <div className={`grid gap-3 md:grid-cols-2 ${personalPlaceRules.enabled ? "" : "opacity-65"}`}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              disabled={!personalPlaceRules.enabled}
              type="checkbox"
              checked={personalPlaceRules.requireWalk}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
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
              <HelpTip text="Maximum acceptable walking time to each personal place in scope." />
            </div>
            <Input
              disabled={!personalPlaceRules.enabled || !personalPlaceRules.requireWalk}
              type="number"
              min={1}
              max={180}
              value={personalPlaceRules.maxWalkMinutes}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
                  ...current,
                  maxWalkMinutes: toNumber(event.target.value, current.maxWalkMinutes)
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              disabled={!personalPlaceRules.enabled}
              type="checkbox"
              checked={personalPlaceRules.requireDrive}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
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
              <HelpTip text="Maximum acceptable driving time to each personal place in scope." />
            </div>
            <Input
              disabled={!personalPlaceRules.enabled || !personalPlaceRules.requireDrive}
              type="number"
              min={1}
              max={180}
              value={personalPlaceRules.maxDriveMinutes}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
                  ...current,
                  maxDriveMinutes: toNumber(event.target.value, current.maxDriveMinutes)
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input
              disabled={!personalPlaceRules.enabled}
              type="checkbox"
              checked={personalPlaceRules.onlyIncludedInScoring}
              onChange={(event) =>
                updatePersonalPlaceRules((current) => ({
                  ...current,
                  onlyIncludedInScoring: event.target.checked
                }))
              }
            />
            Apply only to personal places that are currently included in scoring
          </label>
        </div>
      </div>
    </Card>
  );
}
