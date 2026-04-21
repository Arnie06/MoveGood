"use client";

import { ReactNode, useMemo } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { Input } from "@/components/ui/input";
import { defaultAppSettings } from "@/lib/constants";
import { AmenityCategory, ScoreWeights } from "@/lib/types/domain";

const poiCategories: AmenityCategory[] = ["grocery", "gym", "park", "restaurant", "coffee", "bar"];

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
              <SettingLabel label={`${label} Weight`} tip="Higher values increase this factor's influence on overall score." />
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
            <SettingLabel label="Confidence threshold" tip="Locations below this confidence are lower-trust due to sparse data." />
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
            <SettingLabel label="Normalization mode" tip="Raw keeps direct model output. Percentile compares against your analyzed set." />
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
            <HelpTip text="Filters out weak-data results from score-centric experiences." />
          </label>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Safety">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <SettingLabel label="Crime radius (mi)" tip="Distance used to gather incidents around a location." />
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
            <SettingLabel label="Lookback window" tip="How far back incidents are considered in safety context." />
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
            <SettingLabel label="Night weight" tip="Relative emphasis for night-time comfort/safety." />
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
              <SettingLabel label={`${key[0].toUpperCase()}${key.slice(1)} emphasis`} tip="Higher = this category impacts safety more." />
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
            <SettingLabel label="Walk speed profile" tip="Changes how walking accessibility is interpreted." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.travel.walkSpeedProfile} onChange={(event) => updateSettings({ travel: { ...settings.travel, walkSpeedProfile: event.target.value as "easy" | "average" | "fast" } })}>
              <option value="easy">Easy</option>
              <option value="average">Average</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Traffic profile" tip="Controls peak/off-peak drive-time sensitivity." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.travel.trafficProfile} onChange={(event) => updateSettings({ travel: { ...settings.travel, trafficProfile: event.target.value as "off-peak" | "balanced" | "peak-heavy" } })}>
              <option value="off-peak">Off-peak</option>
              <option value="balanced">Balanced</option>
              <option value="peak-heavy">Peak-heavy</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Max destinations routed" tip="Upper bound for route targets to balance speed vs detail." />
            <Input type="number" min={1} max={50} value={settings.travel.maxDestinationsRouted} onChange={(event) => updateSettings({ travel: { ...settings.travel, maxDestinationsRouted: toNumber(event.target.value, 12) } })} />
          </label>
          {(["grocery", "park", "coffee", "bar"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <SettingLabel label={`${key[0].toUpperCase()}${key.slice(1)} max walk (min)`} tip="Comfort target for this amenity type." />
              <Input type="number" min={1} max={60} value={settings.travel.amenityWalkCaps[key]} onChange={(event) => updateSettings({ travel: { ...settings.travel, amenityWalkCaps: { ...settings.travel.amenityWalkCaps, [key]: toNumber(event.target.value, 20) } } })} />
            </label>
          ))}
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Must-Haves">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <SettingLabel label="Preset" tip="Loads a themed must-have starter config." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.mustHaves.preset} onChange={(event) => updateSettings({ mustHaves: { ...settings.mustHaves, preset: event.target.value as "starter" | "family" | "commuter" | "nightlife" | "custom" } })}>
              <option value="custom">Custom</option>
              <option value="starter">Starter</option>
              <option value="family">Family</option>
              <option value="commuter">Commuter</option>
              <option value="nightlife">Nightlife</option>
            </select>
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.mustHaves.failFast} onChange={(event) => updateSettings({ mustHaves: { ...settings.mustHaves, failFast: event.target.checked } })} />
            Fail-fast
            <HelpTip text="Flags a location quickly when any must-have fails." />
          </label>
        </div>
        <div className="mt-4">
          <SettingLabel label="Required saved places" tip="Selected personal places must be represented in commute context." className="mb-2" />
          <div className="grid gap-2 md:grid-cols-2">
            {preferences.savedPlaces.length === 0 ? (
              <div className="text-sm text-gray-500">Add saved places below to mark required ones.</div>
            ) : preferences.savedPlaces.map((place) => (
              <label key={place.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={settings.mustHaves.requiredSavedPlaceIds.includes(place.id)} onChange={(event) => {
                  const nextIds = event.target.checked
                    ? [...settings.mustHaves.requiredSavedPlaceIds, place.id]
                    : settings.mustHaves.requiredSavedPlaceIds.filter((id) => id !== place.id);
                  updateSettings({ mustHaves: { ...settings.mustHaves, requiredSavedPlaceIds: Array.from(new Set(nextIds)) } });
                }} />
                {place.label}
              </label>
            ))}
          </div>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection title="Data & Reliability">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.dataReliability.localOnlyMode} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, localOnlyMode: event.target.checked } })} />
            Local-only mode preference
            <HelpTip text="Prioritizes local datasets/caches and avoids external reliance where possible." />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.dataReliability.showEstimatedData} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, showEstimatedData: event.target.checked } })} />
            Show estimated data notes
            <HelpTip text="Shows when values are inferred rather than directly sourced." />
          </label>
          {(["geocoder", "routing", "poi", "safety"] as const).map((provider) => (
            <label key={provider} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={settings.dataReliability.providerToggles[provider]} onChange={(event) => updateSettings({ dataReliability: { ...settings.dataReliability, providerToggles: { ...settings.dataReliability.providerToggles, [provider]: event.target.checked } } })} />
              Enable {provider}
              <HelpTip text="Turns this provider category on/off for data enrichment." />
            </label>
          ))}
          <label className="space-y-1">
            <SettingLabel label="Cache freshness" tip="Prefer cached for speed, or fresh for newest data." />
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
            <SettingLabel label="Default search area" tip="Initial area used for browse/search context." />
            <Input value={settings.mapBrowse.defaultSearchArea} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultSearchArea: event.target.value } })} />
          </label>
          <label className="space-y-1">
            <SettingLabel label="Default zoom" tip="Initial map zoom level when opening map views." />
            <Input type="number" min={4} max={18} value={settings.mapBrowse.defaultZoom} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, defaultZoom: toNumber(event.target.value, 11) } })} />
          </label>
          <label className="space-y-1">
            <SettingLabel label="Crime date default" tip="Default incident time filter for crime overlays." />
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
            <HelpTip text="Automatically enables crime layer when map views load." />
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.mapBrowse.autoRefreshOnViewportChange} onChange={(event) => updateSettings({ mapBrowse: { ...settings.mapBrowse, autoRefreshOnViewportChange: event.target.checked } })} />
            Auto-refresh on pan/zoom
            <HelpTip text="Refreshes viewport POIs/crime after map movement." />
          </label>
        </div>
        <div className="mt-4">
          <SettingLabel label="Default POI categories" tip="POI overlays enabled by default in browse views." className="mb-2" />
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
            <SettingLabel label="Explainability verbosity" tip="Simple shortens rationale text; detailed shows more context." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.explainabilityVerbosity} onChange={(event) => updateSettings({ ux: { ...settings.ux, explainabilityVerbosity: event.target.value as "simple" | "detailed" } })}>
              <option value="simple">Simple</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Distance unit" tip="Controls distance formatting in travel and map displays." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.distanceUnit} onChange={(event) => updateSettings({ ux: { ...settings.ux, distanceUnit: event.target.value as "mi" | "km" } })}>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
          <label className="space-y-1">
            <SettingLabel label="Minute display" tip="Compact uses short minute labels; verbose is more descriptive." />
            <select className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={settings.ux.minuteDisplay} onChange={(event) => updateSettings({ ux: { ...settings.ux, minuteDisplay: event.target.value as "compact" | "verbose" } })}>
              <option value="compact">Compact</option>
              <option value="verbose">Verbose</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={settings.ux.autoSaveComparisonSnapshots} onChange={(event) => updateSettings({ ux: { ...settings.ux, autoSaveComparisonSnapshots: event.target.checked } })} />
            Auto-save comparison snapshots
            <HelpTip text="Keeps automatic snapshots of compare states for later review." />
          </label>
        </div>
      </SettingsAccordionSection>
    </div>
  );
}
