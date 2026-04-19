"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SavedPlacesManager() {
  const { preferences, setPreferences } = usePreferences();
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
      <div className="mb-6">
        <h3 className="font-display text-2xl text-ink">Saved personal places</h3>
        <p className="mt-2 text-sm text-gray-600">
          Add work, family, school, doctors, or any other place you want to factor into scoring later.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Work" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
        />
      </div>
      <div className="mt-4">
        <Button
          onClick={onAddSavedPlace}
          disabled={!label || !address || isSubmitting}
        >
          {isSubmitting ? "Adding place..." : "Add saved place"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {preferences.savedPlaces.map((place) => (
          <div key={place.id} className="rounded-2xl bg-black/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-ink">{place.label}</div>
                <div className="text-sm text-gray-500">{place.address}</div>
                <div className="mt-2 text-xs uppercase tracking-wide text-gray-500">
                  {place.category}
                </div>
              </div>
              <div className="flex flex-col gap-2">
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
                  {place.includeInScoring ? "Included" : "Excluded"}
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
