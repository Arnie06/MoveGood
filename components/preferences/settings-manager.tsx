"use client";

import { useMemo } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defaultAppSettings } from "@/lib/constants";
import { AmenityCategory, ScoreWeights } from "@/lib/types/domain";

const poiCategories: AmenityCategory[] = ["grocery", "gym", "park", "restaurant", "coffee", "bar"];

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsManager() {
  const { preferences, setPreferences } = usePreferences();
  const settings = preferences.settings ?? defaultAppSettings;

  const weightTotal = useMemo(
    () =>
      preferences.scoringWeights.safety +
      preferences.scoringWeights.accessibility +
      preferences.scoringWeights.walk +
      preferences.scoringWeights.drive +
      preferences.scoringWeights.affordability +
      preferences.scoringWeights.homeFit +
      preferences.scoringWeights.lifestyle,
    [preferences.scoringWeights]
  );

  function updateWeights(next: Partial<ScoreWeights>) {
    setPreferences({
      ...preferences,
      scoringWeights: {
        ...preferences.scoringWeights,
        ...next
      }
    });
  }

  function updateSettings(next: Partial<typeof settings>) {
    setPreferences({
      ...preferences,
      settings: {
        ...settings,
        ...next
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Scoring</h3>
          <p className="mt-1 text-sm text-gray-600">
            Tune score model behavior. Weight total should usually stay near 100 (currently {weightTotal}).
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ["safety", "Safety"],
              ["accessibility", "Accessibility"],
              ["walk", "Walk"],
              ["drive", "Drive"],
              ["lifestyle", "Lifestyle"],
              ["affordability", "Affordability"],
              ["homeFit", "Home Fit"]
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-sm text-gray-600">{label} Weight</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={preferences.scoringWeights[key]}
                onChange={(event) => updateWeights({ [key]: toNumber(event.target.value, 0) })}
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Confidence threshold</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={settings.scoring.confidenceThreshold}
              onChange={(event) =>
                updateSettings({
                  scoring: {
                    ...settings.scoring,
                    confidenceThreshold: toNumber(event.target.value, 55)
                  }
                })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Normalization mode</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.scoring.normalizationMode}
              onChange={(event) =>
                updateSettings({
                  scoring: {
                    ...settings.scoring,
                    normalizationMode: event.target.value as "raw" | "percentile"
                  }
                })
              }
            >
              <option value="raw">Raw</option>
              <option value="percentile">Percentile</option>
            </select>
          </label>
          <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.scoring.strictMode}
              onChange={(event) =>
                updateSettings({
                  scoring: {
                    ...settings.scoring,
                    strictMode: event.target.checked
                  }
                })
              }
            />
            Strict mode (exclude weak-data results)
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Safety</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Crime radius (mi)</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={String(settings.safety.crimeRadiusMiles)}
              onChange={(event) =>
                updateSettings({
                  safety: {
                    ...settings.safety,
                    crimeRadiusMiles: Number(event.target.value) as 0.5 | 1 | 1.5 | 2
                  }
                })
              }
            >
              <option value="0.5">0.5</option>
              <option value="1">1.0</option>
              <option value="1.5">1.5</option>
              <option value="2">2.0</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Lookback window</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={String(settings.safety.lookbackWindowDays)}
              onChange={(event) =>
                updateSettings({
                  safety: {
                    ...settings.safety,
                    lookbackWindowDays: Number(event.target.value) as 90 | 365 | 730
                  }
                })
              }
            >
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Night weight</span>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={settings.safety.nightWeight}
              onChange={(event) =>
                updateSettings({
                  safety: {
                    ...settings.safety,
                    nightWeight: toNumber(event.target.value, 1)
                  }
                })
              }
            />
          </label>
          {(["violent", "property", "theft"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-sm capitalize text-gray-600">{key} emphasis</span>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={settings.safety.categoryEmphasis[key]}
                onChange={(event) =>
                  updateSettings({
                    safety: {
                      ...settings.safety,
                      categoryEmphasis: {
                        ...settings.safety.categoryEmphasis,
                        [key]: toNumber(event.target.value, 1)
                      }
                    }
                  })
                }
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Travel & Proximity</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Walk speed profile</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.travel.walkSpeedProfile}
              onChange={(event) =>
                updateSettings({
                  travel: {
                    ...settings.travel,
                    walkSpeedProfile: event.target.value as "easy" | "average" | "fast"
                  }
                })
              }
            >
              <option value="easy">Easy</option>
              <option value="average">Average</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Traffic profile</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.travel.trafficProfile}
              onChange={(event) =>
                updateSettings({
                  travel: {
                    ...settings.travel,
                    trafficProfile: event.target.value as "off-peak" | "balanced" | "peak-heavy"
                  }
                })
              }
            >
              <option value="off-peak">Off-peak</option>
              <option value="balanced">Balanced</option>
              <option value="peak-heavy">Peak-heavy</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Max destinations routed</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={settings.travel.maxDestinationsRouted}
              onChange={(event) =>
                updateSettings({
                  travel: {
                    ...settings.travel,
                    maxDestinationsRouted: toNumber(event.target.value, 12)
                  }
                })
              }
            />
          </label>
          {(["grocery", "park", "coffee", "bar"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-sm capitalize text-gray-600">{key} max walk (min)</span>
              <Input
                type="number"
                min={1}
                max={60}
                value={settings.travel.amenityWalkCaps[key]}
                onChange={(event) =>
                  updateSettings({
                    travel: {
                      ...settings.travel,
                      amenityWalkCaps: {
                        ...settings.travel.amenityWalkCaps,
                        [key]: toNumber(event.target.value, 20)
                      }
                    }
                  })
                }
              />
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Must-Haves</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Preset</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.mustHaves.preset}
              onChange={(event) =>
                updateSettings({
                  mustHaves: {
                    ...settings.mustHaves,
                    preset: event.target.value as "starter" | "family" | "commuter" | "nightlife" | "custom"
                  }
                })
              }
            >
              <option value="custom">Custom</option>
              <option value="starter">Starter</option>
              <option value="family">Family</option>
              <option value="commuter">Commuter</option>
              <option value="nightlife">Nightlife</option>
            </select>
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.mustHaves.failFast}
              onChange={(event) =>
                updateSettings({
                  mustHaves: {
                    ...settings.mustHaves,
                    failFast: event.target.checked
                  }
                })
              }
            />
            Fail-fast on hard-rule misses
          </label>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm text-gray-600">Required saved places</div>
          <div className="grid gap-2 md:grid-cols-2">
            {preferences.savedPlaces.length === 0 ? (
              <div className="text-sm text-gray-500">Add saved places below to mark required ones.</div>
            ) : preferences.savedPlaces.map((place) => (
              <label key={place.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.mustHaves.requiredSavedPlaceIds.includes(place.id)}
                  onChange={(event) => {
                    const nextIds = event.target.checked
                      ? [...settings.mustHaves.requiredSavedPlaceIds, place.id]
                      : settings.mustHaves.requiredSavedPlaceIds.filter((id) => id !== place.id);
                    updateSettings({
                      mustHaves: {
                        ...settings.mustHaves,
                        requiredSavedPlaceIds: Array.from(new Set(nextIds))
                      }
                    });
                  }}
                />
                {place.label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Data & Reliability</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.dataReliability.localOnlyMode}
              onChange={(event) =>
                updateSettings({
                  dataReliability: {
                    ...settings.dataReliability,
                    localOnlyMode: event.target.checked
                  }
                })
              }
            />
            Local-only mode preference
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.dataReliability.showEstimatedData}
              onChange={(event) =>
                updateSettings({
                  dataReliability: {
                    ...settings.dataReliability,
                    showEstimatedData: event.target.checked
                  }
                })
              }
            />
            Show estimated data notes
          </label>
          {(["geocoder", "routing", "poi", "safety"] as const).map((provider) => (
            <label key={provider} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.dataReliability.providerToggles[provider]}
                onChange={(event) =>
                  updateSettings({
                    dataReliability: {
                      ...settings.dataReliability,
                      providerToggles: {
                        ...settings.dataReliability.providerToggles,
                        [provider]: event.target.checked
                      }
                    }
                  })
                }
              />
              Enable {provider}
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Cache freshness</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.dataReliability.cacheFreshness}
              onChange={(event) =>
                updateSettings({
                  dataReliability: {
                    ...settings.dataReliability,
                    cacheFreshness: event.target.value as "prefer-cached" | "prefer-fresh"
                  }
                })
              }
            >
              <option value="prefer-cached">Prefer cached</option>
              <option value="prefer-fresh">Prefer fresh</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">Map & Browse</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-gray-600">Default search area</span>
            <Input
              value={settings.mapBrowse.defaultSearchArea}
              onChange={(event) =>
                updateSettings({
                  mapBrowse: {
                    ...settings.mapBrowse,
                    defaultSearchArea: event.target.value
                  }
                })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Default zoom</span>
            <Input
              type="number"
              min={4}
              max={18}
              value={settings.mapBrowse.defaultZoom}
              onChange={(event) =>
                updateSettings({
                  mapBrowse: {
                    ...settings.mapBrowse,
                    defaultZoom: toNumber(event.target.value, 11)
                  }
                })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Crime date default</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.mapBrowse.defaultCrimeDateFilter}
              onChange={(event) =>
                updateSettings({
                  mapBrowse: {
                    ...settings.mapBrowse,
                    defaultCrimeDateFilter: event.target.value as "30d" | "90d" | "1y" | "2y" | "all"
                  }
                })
              }
            >
              <option value="30d">30D</option>
              <option value="90d">90D</option>
              <option value="1y">1Y</option>
              <option value="2y">2Y</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.mapBrowse.defaultCrimeOverlayOn}
              onChange={(event) =>
                updateSettings({
                  mapBrowse: {
                    ...settings.mapBrowse,
                    defaultCrimeOverlayOn: event.target.checked
                  }
                })
              }
            />
            Crime overlay on by default
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.mapBrowse.autoRefreshOnViewportChange}
              onChange={(event) =>
                updateSettings({
                  mapBrowse: {
                    ...settings.mapBrowse,
                    autoRefreshOnViewportChange: event.target.checked
                  }
                })
              }
            />
            Auto-refresh on pan/zoom
          </label>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm text-gray-600">Default POI categories</div>
          <div className="grid gap-2 md:grid-cols-3">
            {poiCategories.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.mapBrowse.defaultPoiCategories.includes(category)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...settings.mapBrowse.defaultPoiCategories, category]
                      : settings.mapBrowse.defaultPoiCategories.filter((item) => item !== category);
                    updateSettings({
                      mapBrowse: {
                        ...settings.mapBrowse,
                        defaultPoiCategories: Array.from(new Set(next))
                      }
                    });
                  }}
                />
                <span className="capitalize">{category}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="font-display text-2xl text-ink">UX</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Explainability verbosity</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.ux.explainabilityVerbosity}
              onChange={(event) =>
                updateSettings({
                  ux: {
                    ...settings.ux,
                    explainabilityVerbosity: event.target.value as "simple" | "detailed"
                  }
                })
              }
            >
              <option value="simple">Simple</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Distance unit</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.ux.distanceUnit}
              onChange={(event) =>
                updateSettings({
                  ux: {
                    ...settings.ux,
                    distanceUnit: event.target.value as "mi" | "km"
                  }
                })
              }
            >
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Minute display</span>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              value={settings.ux.minuteDisplay}
              onChange={(event) =>
                updateSettings({
                  ux: {
                    ...settings.ux,
                    minuteDisplay: event.target.value as "compact" | "verbose"
                  }
                })
              }
            >
              <option value="compact">Compact</option>
              <option value="verbose">Verbose</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.ux.autoSaveComparisonSnapshots}
              onChange={(event) =>
                updateSettings({
                  ux: {
                    ...settings.ux,
                    autoSaveComparisonSnapshots: event.target.checked
                  }
                })
              }
            />
            Auto-save comparison snapshots
          </label>
        </div>
      </Card>
    </div>
  );
}
