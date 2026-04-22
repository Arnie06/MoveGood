"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookmarkPlus, LoaderCircle } from "lucide-react";

import { DemoMap } from "@/components/map/demo-map";
import { AddressSearch } from "@/components/location/address-search";
import { useLocationStore } from "@/components/providers/location-store-provider";
import { AmenitiesPanel } from "@/components/property/amenities-panel";
import { ExplanationPanel } from "@/components/property/explanation-panel";
import { PreferenceTravelPanel } from "@/components/property/preference-travel-panel";
import { RequirementsPanel } from "@/components/property/requirements-panel";
import { ScoreCard } from "@/components/property/score-card";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { amenityColorMap } from "@/lib/poi-colors";
import { AmenityPOI, AnalyzedLocation, CrimeIncident, SavedAnalyzedLocation } from "@/lib/types/domain";
import { formatCompactNumber, slugify } from "@/lib/utils";

type PendingSelection = {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
};

export function LocationBrowser() {
  const { preferences } = usePreferences();
  const { savedLocations, saveLocation, removeLocation, setCompareIncluded, isCompared } = useLocationStore();
  const [selected, setSelected] = useState<AnalyzedLocation | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [browseAmenities, setBrowseAmenities] = useState<AmenityPOI[]>([]);
  const [browseCrimeIncidents, setBrowseCrimeIncidents] = useState<CrimeIncident[]>([]);
  const [isBrowseViewportLoading, setIsBrowseViewportLoading] = useState(false);
  const [showBrowseCrime, setShowBrowseCrime] = useState(false);

  const matchingSavedLocation = useMemo(
    () =>
      selected
        ? savedLocations.find(
            (location) =>
              location.canonicalAddress === selected.property.canonicalAddress &&
              Math.abs(location.lat - selected.property.lat) < 0.0001 &&
              Math.abs(location.lng - selected.property.lng) < 0.0001
          )
        : undefined,
    [savedLocations, selected]
  );

  async function analyzeLocation(input: PendingSelection) {
    setIsAnalyzing(true);
    setError(null);
    setSelectedLabel(input.label);
    setPendingSelection(input);
    setSelected(null);
    setSaveName("");

    try {
      const params = new URLSearchParams();
      if (input.address) params.set("address", input.address);
      if (input.label) params.set("label", input.label);
      if (input.lat != null) params.set("lat", String(input.lat));
      if (input.lng != null) params.set("lng", String(input.lng));

      const response = await fetch(`/api/location-analysis?${params.toString()}`);
      const payload = (await response.json()) as {
        result?: AnalyzedLocation;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Could not analyze that location.");
      }

      setSelected(payload.result);
      setSaveName(input.label === "Dropped Pin" ? "Pinned location" : input.label);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not analyze that location.");
    } finally {
      setIsAnalyzing(false);
      setPendingSelection(null);
    }
  }

  function clearSelection() {
    setSelected(null);
    setSelectedLabel("");
    setSaveName("");
    setError(null);
    setPendingSelection(null);
  }

  function saveCurrentLocation() {
    if (!selected || !saveName.trim()) return;
    setIsSaving(true);

    const item: SavedAnalyzedLocation = {
      id:
        matchingSavedLocation?.id ??
        `${slugify(saveName)}-${selected.property.lat.toFixed(5)}-${selected.property.lng.toFixed(5)}`,
      name: saveName.trim(),
      canonicalAddress: selected.property.canonicalAddress,
      lat: selected.property.lat,
      lng: selected.property.lng,
      analysis: selected,
      createdAt: matchingSavedLocation?.createdAt ?? new Date().toISOString()
    };

    saveLocation(item);
    setIsSaving(false);
    setShowSaveModal(false);
  }

  const groupedBrowseAmenities = useMemo(() => {
    return Object.entries(
      browseAmenities.reduce<Record<string, AmenityPOI[]>>((accumulator, amenity) => {
        const key = amenity.category;
        accumulator[key] ??= [];
        accumulator[key].push(amenity);
        return accumulator;
      }, {})
    ).sort((a, b) => b[1].length - a[1].length);
  }, [browseAmenities]);

  const recentCrimeIncidents = useMemo(
    () => [...browseCrimeIncidents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 6),
    [browseCrimeIncidents]
  );

  const selectedItems = useMemo(() => (selected ? [selected] : []), [selected]);
  const hasAnalyzeFocus = Boolean(selected || pendingSelection);
  const displayAddress = pendingSelection?.address ?? selected?.property.canonicalAddress;

  return (
    <div className="space-y-6 pb-12">
      <section className="section-shell p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <DemoMap
            items={selectedItems}
            selectedId={selected?.property.id}
            browseMode
            onLocationSelect={analyzeLocation}
            onClearFocus={selected ? clearSelection : undefined}
            onBrowseViewportChange={({ amenities, crimeIncidents, isLoading, showCrimeOverlay }) => {
              setBrowseAmenities(amenities);
              setBrowseCrimeIncidents(crimeIncidents);
              setIsBrowseViewportLoading(isLoading);
              setShowBrowseCrime(showCrimeOverlay);
            }}
            highlightedBrowseTarget={
              pendingSelection?.lat != null && pendingSelection?.lng != null
                ? {
                    label: pendingSelection.label,
                    lat: pendingSelection.lat,
                    lng: pendingSelection.lng
                  }
                : null
            }
            topContent={
              <AddressSearch
                onSelect={analyzeLocation}
                selectedAddress={pendingSelection?.address ?? selected?.property.canonicalAddress ?? ""}
                hasActiveSelection={Boolean(selected || pendingSelection)}
                onClearSelection={clearSelection}
              />
            }
            showSummaryPanel={false}
          />
          <div className="max-h-[820px] overflow-y-auto pr-1">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{hasAnalyzeFocus ? "Selected location" : "Browse mode"}</Badge>
                {matchingSavedLocation ? <Badge tone="default">Saved</Badge> : null}
                {selected && matchingSavedLocation ? (
                  <Badge tone="muted">{matchingSavedLocation.name}</Badge>
                ) : null}
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                  {hasAnalyzeFocus ? "Selected address or POI" : "Current map area"}
                </div>
                <h2 className="font-display text-3xl text-ink">
                  {selectedLabel || pendingSelection?.label || "Browse the map"}
                </h2>
              </div>
              <div className="rounded-2xl bg-black/[0.03] p-4 text-sm text-gray-600">
                {displayAddress
                  ? displayAddress
                  : "Search an address, click a POI, or drop a pin to start analyzing a location while the map continues to browse live nearby context."}
              </div>
              <div className="rounded-2xl bg-black/[0.03] p-4 text-sm text-gray-600">
                {hasAnalyzeFocus
                  ? "This panel scrolls independently so you can keep the map visible while reviewing scores, nearby essentials, and travel times."
                  : "POIs and crime should follow the visible map area even when nothing is selected."}
              </div>
              {isAnalyzing ? (
                <div className="rounded-2xl bg-black/[0.03] p-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Recalculating this location
                  </div>
                  <div className="mt-2">
                    Fetching updated amenities, crime, and travel times for{" "}
                    {pendingSelection?.label ?? "the selected spot"}…
                  </div>
                </div>
              ) : null}
              {error ? <div className="rounded-2xl bg-clay/10 p-4 text-sm text-clay">{error}</div> : null}
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    {matchingSavedLocation ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => removeLocation(matchingSavedLocation.id)}
                        >
                          Remove from saved
                        </Button>
                        <Button
                          variant={isCompared(matchingSavedLocation.id) ? "outline" : "ghost"}
                          onClick={() =>
                            setCompareIncluded(
                              matchingSavedLocation.id,
                              !isCompared(matchingSavedLocation.id)
                            )
                          }
                        >
                          {isCompared(matchingSavedLocation.id)
                            ? "Remove from compare"
                            : "Add to compare"}
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setShowSaveModal(true)}>
                        <BookmarkPlus className="mr-2 h-4 w-4" />
                        Save location
                      </Button>
                    )}
                  </div>

                  <section className="space-y-6">
                    <ScoreCard score={selected.score} />
                    <RequirementsPanel score={selected.score} />
                  </section>
                  <ExplanationPanel item={selected} compact />
                  <PreferenceTravelPanel
                    item={selected}
                    savedPlaces={preferences.savedPlaces.filter((place) => place.includeInScoring)}
                    compact
                  />
                  <AmenitiesPanel item={selected} compact />
                </>
              ) : pendingSelection ? (
                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                      Analyzing Location
                    </div>
                    <h3 className="mt-1 font-display text-2xl text-ink">{pendingSelection.label}</h3>
                    <p className="mt-2 text-sm text-gray-600">{pendingSelection.address}</p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading score, routes, amenities, and crime for this selection…
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <Link href="/compare" className="inline-flex text-sm font-semibold text-ocean">
                    Open compare page
                  </Link>
                  {isBrowseViewportLoading ? (
                    <Card className="p-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Refreshing map context
                      </div>
                      <div className="mt-2">
                        Updating POIs and crime for the current visible map area.
                      </div>
                    </Card>
                  ) : null}
                  <div className="grid gap-4">
                    <Card className="p-5">
                      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                        Visible POIs
                      </div>
                      <h3 className="mt-1 font-display text-2xl text-ink">
                        {browseAmenities.length} nearby
                      </h3>
                      <div className="mt-4 space-y-3">
                        {groupedBrowseAmenities.length > 0 ? (
                          groupedBrowseAmenities.slice(0, 6).map(([category, amenities]) => {
                            const palette =
                              amenityColorMap[category as keyof typeof amenityColorMap];
                            return (
                              <div
                                key={category}
                                className="rounded-2xl border p-3"
                                style={{
                                  backgroundColor: palette.bg,
                                  borderColor: palette.border
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold capitalize" style={{ color: palette.text }}>
                                    {category}
                                  </div>
                                  <div
                                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                    style={{ backgroundColor: palette.border, color: "#fff" }}
                                  >
                                    {amenities.length}
                                  </div>
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  {amenities
                                    .slice(0, 3)
                                    .map((amenity) => amenity.name)
                                    .join(", ")}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-sm text-gray-500">
                            Pan or zoom the map to load nearby places for this area.
                          </div>
                        )}
                      </div>
                    </Card>
                    {showBrowseCrime ? (
                      <Card className="p-5">
                        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                          Crime in View
                        </div>
                        <h3 className="mt-1 font-display text-2xl text-ink">
                          {formatCompactNumber(browseCrimeIncidents.length)} incidents
                        </h3>
                        <div className="mt-2 text-sm text-gray-500">
                          Most recent reports visible in the current map bounds.
                        </div>
                        <div className="mt-4 space-y-3">
                          {recentCrimeIncidents.length > 0 ? (
                            recentCrimeIncidents.map((incident) => (
                              <div key={incident.id} className="rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                                <div className="font-semibold text-ink">{incident.label}</div>
                                <div className="mt-1 text-sm text-gray-600">
                                  {incident.blockAddress ?? "Approximate nearby block"}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-gray-500">
                                  {incident.category} •{" "}
                                  {new Date(incident.occurredAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">
                              Crime markers and counts appear here as the visible area updates.
                            </div>
                          )}
                        </div>
                      </Card>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showSaveModal && selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
          <Card className="w-full max-w-md p-6">
            <div className="space-y-2">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                Save Location
              </div>
              <h3 className="font-display text-2xl text-ink">Name this location</h3>
              <p className="text-sm text-gray-600">{selected.property.canonicalAddress}</p>
            </div>
            <div className="mt-5">
              <Input
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Downtown gym shortlist"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveCurrentLocation} disabled={!saveName.trim() || isSaving}>
                {isSaving ? "Saving..." : "Save location"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
