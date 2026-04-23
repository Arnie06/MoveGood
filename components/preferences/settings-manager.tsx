"use client";

import { ReactNode, useMemo } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { Input } from "@/components/ui/input";
import { defaultAppSettings } from "@/lib/constants";
import { AmenityCategory, ScoreWeights } from "@/lib/types/domain";

const poiCategories: AmenityCategory[] = ["grocery", "gym", "park", "restaurant", "coffee", "bar"];
const mustHavePoiCategories = ["park", "restaurant", "bar", "gym", "coffee"] as const;

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function SettingLabel({ label, tip, className }: { label: string; tip: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <HelpTip text={tip} />
    </div>
  );
}

function SettingsAccordionSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-3xl border border-black/10 bg-white p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div>
          <h3 className="font-display text-2xl text-ink">{title}</h3>
          {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
        </div>
        <div className="text-xl font-semibold text-gray-500">
          <span className="group-open:hidden">▸</span>
          <span className="hidden group-open:inline">▾</span>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
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
      <SettingsAccordionSection
        title="Scoring"
        description={`Tune score model behavior. Weight total should usually stay near 100 (currently ${weightTotal}).`}
      >
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
              <SettingLabel label={`${label} Weight`} tip="Increasing this makes the overall score move more with this factor; lowering it reduces this factor's impact." />
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
            <SettingLabel label="Confidence threshold" tip="Raising this marks more locations as low-confidence; lowering it allows more sparse-data locations to be treated as acceptable." />
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
            <SettingLabel label="Normalization mode" tip="Raw shows direct model scores. Percentile rescales scores against your saved/analyzed set, so ranking is relative to your own dataset." />
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
            Strict mode
            <HelpTip text="When on, low-confidence locations are de-emphasized or excluded in score-first views. When off, they still appear with caution notes." />
          </label>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Safety">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <SettingLabel label="Crime radius (mi)" tip="Larger radius includes more incidents and smooths local spikes; smaller radius focuses on very nearby blocks and is more sensitive to street-level differences." />
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
            <SettingLabel label="Lookback window" tip="Longer windows stabilize safety scores using more history; shorter windows react faster to recent changes but can be noisier." />
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
            <SettingLabel label="Night weight" tip="Higher values penalize places with weaker night-time safety context more strongly; lower values make nighttime factors less influential." />
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
              <SettingLabel label={`${key[0].toUpperCase()}${key.slice(1)} emphasis`} tip={`Increase to make ${key} incidents affect safety score more; decrease to reduce its contribution.`} />
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
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Travel & Proximity">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <SettingLabel label="Walk speed profile" tip="Easy assumes slower walking and yields longer walk-time expectations. Fast assumes quicker walking and makes accessibility appear stronger." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.travel.walkSpeedProfile} onChange={(event) => updateSettings({ travel: { ...settings.travel, walkSpeedProfile: event.target.value as "easy" | "average" | "fast" } })}>
              <option value="easy">Easy</option>
              <option value="average">Average</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Traffic profile" tip="Off-peak favors lighter traffic assumptions; peak-heavy applies stronger rush-hour penalties to driving metrics and commute scoring." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.travel.trafficProfile} onChange={(event) => updateSettings({ travel: { ...settings.travel, trafficProfile: event.target.value as "off-peak" | "balanced" | "peak-heavy" } })}>
              <option value="off-peak">Off-peak</option>
              <option value="balanced">Balanced</option>
              <option value="peak-heavy">Peak-heavy</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Max destinations routed" tip="Higher values route more places (better coverage, slower analysis). Lower values speed up analysis but may leave some categories estimated or missing." />
            <Input type="number" min={1} max={50} value={settings.travel.maxDestinationsRouted} onChange={(event) => updateSettings({ travel: { ...settings.travel, maxDestinationsRouted: toNumber(event.target.value, 12) } })} />
          </label>
          {(["grocery", "park", "coffee", "bar"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <SettingLabel label={`${key[0].toUpperCase()}${key.slice(1)} max walk (min)`} tip={`Shorter cap makes ${key} walkability stricter and harder to score well. Longer cap is more forgiving for that amenity.`} />
              <Input type="number" min={1} max={60} value={settings.travel.amenityWalkCaps[key]} onChange={(event) => updateSettings({ travel: { ...settings.travel, amenityWalkCaps: { ...settings.travel.amenityWalkCaps, [key]: toNumber(event.target.value, 20) } } })} />
            </label>
          ))}
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Must-Haves">
        <p className="mb-4 text-sm text-gray-600">
          Configure what must be nearby for each POI. For time checks, enable walk, drive, or both.
        </p>
        <div className="space-y-4">
          {mustHavePoiCategories.map((category) => {
            const rule = settings.mustHaves.poiRules[category];
            return (
              <div key={category} className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                enabled: event.target.checked
                              }
                            }
                          }
                        })
                      }
                    />
                    <span className="font-semibold text-ink">Enable {category}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={rule.requireWalk}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                requireWalk: event.target.checked
                              }
                            }
                          }
                        })
                      }
                    />
                    Require walk
                  </label>
                  <label className="space-y-1">
                    <SettingLabel label="Max walk (min)" tip="Maximum acceptable walk time to the nearest matching POI." />
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={rule.maxWalkMinutes}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                maxWalkMinutes: toNumber(event.target.value, rule.maxWalkMinutes)
                              }
                            }
                          }
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={rule.requireDrive}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                requireDrive: event.target.checked
                              }
                            }
                          }
                        })
                      }
                    />
                    Require drive
                  </label>
                  <label className="space-y-1">
                    <SettingLabel label="Max drive (min)" tip="Maximum acceptable drive time to the nearest matching POI." />
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={rule.maxDriveMinutes}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                maxDriveMinutes: toNumber(event.target.value, rule.maxDriveMinutes)
                              }
                            }
                          }
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={rule.enforceMinimumCount}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                enforceMinimumCount: event.target.checked
                              }
                            }
                          }
                        })
                      }
                    />
                    Require count in radius
                  </label>
                  <label className="space-y-1">
                    <SettingLabel label="Minimum count" tip="How many of this POI type must be within the radius." />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={rule.minimumCount}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                minimumCount: toNumber(event.target.value, rule.minimumCount)
                              }
                            }
                          }
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <SettingLabel label="Radius (mi)" tip="Search radius used for the count requirement." />
                    <Input
                      type="number"
                      min={0.1}
                      max={10}
                      step="0.1"
                      value={rule.countRadiusMiles}
                      onChange={(event) =>
                        updateSettings({
                          mustHaves: {
                            ...settings.mustHaves,
                            poiRules: {
                              ...settings.mustHaves.poiRules,
                              [category]: {
                                ...rule,
                                countRadiusMiles: toNumber(event.target.value, rule.countRadiusMiles)
                              }
                            }
                          }
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Data & Reliability">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.dataReliability.localOnlyMode} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, localOnlyMode: event.target.checked } })} />
            Local-only mode preference
            <HelpTip text="Uses cached/local data first and avoids external calls when possible. Results are faster and cheaper, but can be less fresh or less complete." />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.dataReliability.showEstimatedData} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, showEstimatedData: event.target.checked } })} />
            Show estimated data notes
            <HelpTip text="Adds labels when values are estimated/inferred. Turning it off keeps UI cleaner but hides those provenance hints." />
          </label>
          {(["geocoder", "routing", "poi", "safety"] as const).map((provider) => (
            <label key={provider} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={settings.dataReliability.providerToggles[provider]} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, providerToggles: { ...settings.dataReliability.providerToggles, [provider]: event.target.checked } } })} />
              Enable {provider}
              <HelpTip text={`If disabled, ${provider} data will not be used and related metrics may fall back to estimates or become unavailable.`} />
            </label>
          ))}
          <label className="space-y-1">
            <SettingLabel label="Cache freshness" tip="Prefer cached prioritizes speed and fewer API calls. Prefer fresh attempts newer data more often, which can increase latency and call volume." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.dataReliability.cacheFreshness} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, cacheFreshness: event.target.value as "prefer-cached" | "prefer-fresh" } })}>
              <option value="prefer-cached">Prefer cached</option>
              <option value="prefer-fresh">Prefer fresh</option>
            </select>
          </label>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Map & Browse">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 md:col-span-2">
            <SettingLabel label="Default search area" tip="Sets the location prefilled at app start for map/search context; changing it shifts the initial city/area users land in." />
            <Input value={settings.mapBrowse.defaultSearchArea} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultSearchArea: event.target.value } })} />
          </label>
          <label className="space-y-1">
            <SettingLabel label="Default zoom" tip="Higher zoom starts more street-level and detailed. Lower zoom starts broader with more regional context." />
            <Input type="number" min={4} max={18} value={settings.mapBrowse.defaultZoom} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultZoom: toNumber(event.target.value, 11) } })} />
          </label>
          <label className="space-y-1">
            <SettingLabel label="Crime date default" tip="Sets the default incident time range on map overlays. Short ranges highlight recent activity; longer ranges show broader historical patterns." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.mapBrowse.defaultCrimeDateFilter} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultCrimeDateFilter: event.target.value as "30d" | "90d" | "1y" | "2y" | "all" } })}>
              <option value="30d">30D</option>
              <option value="90d">90D</option>
              <option value="1y">1Y</option>
              <option value="2y">2Y</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.mapBrowse.defaultCrimeOverlayOn} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultCrimeOverlayOn: event.target.checked } })} />
            Crime overlay on by default
            <HelpTip text="If enabled, map opens with crime overlay visible immediately. If disabled, users must turn it on manually." />
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.mapBrowse.autoRefreshOnViewportChange} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, autoRefreshOnViewportChange: event.target.checked } })} />
            Auto-refresh on pan/zoom
            <HelpTip text="When on, panning/zooming triggers automatic POI/crime refresh. When off, data stays static until manually refreshed." />
          </label>
        </div>
        <div className="mt-4">
          <SettingLabel label="Default POI categories" tip="Selected categories load and render by default in browse mode; unselected categories stay hidden unless enabled later." className="mb-2" />
          <div className="grid gap-2 md:grid-cols-3">
            {poiCategories.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={settings.mapBrowse.defaultPoiCategories.includes(category)} onChange={(event) => {
                  const next = event.target.checked
                    ? [...settings.mapBrowse.defaultPoiCategories, category]
                    : settings.mapBrowse.defaultPoiCategories.filter((item) => item !== category);
                  updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultPoiCategories: Array.from(new Set(next)) } });
                }} />
                <span className="capitalize">{category}</span>
              </label>
            ))}
          </div>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="UX">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <SettingLabel label="Explainability verbosity" tip="Simple shows short reason summaries. Detailed shows longer rationale and context for score contributions and tradeoffs." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.explainabilityVerbosity} onChange={(event) => updateSettings({ ux: { ...settings.ux, explainabilityVerbosity: event.target.value as "simple" | "detailed" } })}>
              <option value="simple">Simple</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Distance unit" tip="Switches distance output between miles and kilometers across map labels, travel summaries, and related UI copy." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.distanceUnit} onChange={(event) => updateSettings({ ux: { ...settings.ux, distanceUnit: event.target.value as "mi" | "km" } })}>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Minute display" tip="Compact uses shorter time strings for dense layouts. Verbose uses fuller wording for readability." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.minuteDisplay} onChange={(event) => updateSettings({ ux: { ...settings.ux, minuteDisplay: event.target.value as "compact" | "verbose" } })}>
              <option value="compact">Compact</option>
              <option value="verbose">Verbose</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.ux.autoSaveComparisonSnapshots} onChange={(event) => updateSettings({ ux: { ...settings.ux, autoSaveComparisonSnapshots: event.target.checked } })} />
            Auto-save comparison snapshots
            <HelpTip text="Automatically stores compare-state snapshots as you analyze locations, making it easier to revisit prior side-by-side decisions." />
          </label>
        </div>
      </SettingsAccordionSection>
    </div>
  );
}
