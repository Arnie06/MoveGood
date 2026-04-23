"use client";

import { useMemo, useState } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const categoryOptions = [
  { value: "work", label: "Work" },
  { value: "family", label: "Family" },
  { value: "school", label: "School" },
  { value: "health", label: "Health" },
  { value: "errands", label: "Errands" },
  { value: "custom", label: "Custom" }
] as const;

export function SavedPlacesManager() {
  const { preferences, setPreferences } = usePreferences();
  const sortedPlaces = [...preferences.savedPlaces].sort((a, b) => {
    if (a.includeInScoring !== b.includeInScoring) return a.includeInScoring ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  const includedCount = useMemo(
    () => preferences.savedPlaces.filter((place) => place.includeInScoring).length,
    [preferences.savedPlaces]
  );
  const excludedCount = preferences.savedPlaces.length - includedCount;
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAddSavedPlace() {
    if (!label || !address || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const payload = (await response.json()) as {
        result?: { canonicalAddress: string; lat: number; lng: number };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Could not geocode that place yet.");
      }

      setPreferences({
        ...preferences,
        savedPlaces: [
          ...preferences.savedPlaces,
          {
            id: `saved-${Date.now()}`,
            label,
            category: category || "custom",
            address: payload.result.canonicalAddress,
            lat: payload.result.lat,
            lng: payload.result.lng,
            includeInScoring: true
          }
        ]
      });
      setLabel("");
      setCategory("");
      setAddress("");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Could not add that saved place."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-ink">Saved places</h3>
          <p className="mt-2 text-sm text-gray-600">
            Add your frequent destinations so scoring and travel checks reflect your real routine.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="good">{includedCount} included</Badge>
            <Badge tone="muted">{excludedCount} excluded</Badge>
          </div>
        </div>
        <div className="rounded-full bg-ocean/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">
          {preferences.savedPlaces.length} total
        </div>
      </div>
      <div className="grid gap-3 rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Add place</div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Label</div>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Work" />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Category</div>
            <select
              className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-ocean/30 focus:shadow-md"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Choose category</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-1">
            <div className="text-sm text-gray-600">Address</div>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onAddSavedPlace();
                }
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={onAddSavedPlace}
            disabled={!label || !address || isSubmitting}
          >
            {isSubmitting ? "Adding place..." : "Add place"}
          </Button>
          <span className="text-xs text-gray-500">New places are included in scoring by default.</span>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
      <div className="mt-6 grid gap-3">
        {sortedPlaces.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPreferences({
                  ...preferences,
                  savedPlaces: preferences.savedPlaces.map((place) => ({
                    ...place,
                    includeInScoring: true
                  }))
                })
              }
            >
              Include all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPreferences({
                  ...preferences,
                  savedPlaces: preferences.savedPlaces.map((place) => ({
                    ...place,
                    includeInScoring: false
                  }))
                })
              }
            >
              Exclude all
            </Button>
          </div>
        ) : null}
        {sortedPlaces.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-gray-600">
            No saved places yet. Add work, family, school, or other recurring destinations to personalize results.
          </div>
        ) : null}
        {sortedPlaces.map((place) => (
          <div key={place.id} className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-ink">{place.label}</div>
                  <Badge tone={place.includeInScoring ? "good" : "warn"}>
                    {place.includeInScoring ? "Included" : "Excluded"}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">{place.address}</div>
                <div className="mt-2 text-xs uppercase tracking-wide text-gray-500">
                  {place.category}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      savedPlaces: preferences.savedPlaces.map((saved) =>
                        saved.id === place.id
                          ? {
                              ...saved,
                              includeInScoring: !saved.includeInScoring
                            }
                          : saved
                      )
                    })
                  }
                >
                  {place.includeInScoring ? "Exclude from scoring" : "Include in scoring"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      savedPlaces: preferences.savedPlaces.filter((saved) => saved.id !== place.id)
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
