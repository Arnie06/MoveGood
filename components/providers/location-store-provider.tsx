"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { SavedAnalyzedLocation } from "@/lib/types/domain";

interface LocationStoreContextValue {
  savedLocations: SavedAnalyzedLocation[];
  compareIds: string[];
  saveLocation: (input: SavedAnalyzedLocation) => void;
  removeLocation: (id: string) => void;
  setCompareIncluded: (id: string, included: boolean) => void;
  isCompared: (id: string) => boolean;
}

const STORAGE_KEY = "good-area-location-store-v1";

const LocationStoreContext = createContext<LocationStoreContextValue | undefined>(undefined);

function persist(savedLocations: SavedAnalyzedLocation[], compareIds: string[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      savedLocations,
      compareIds
    })
  );
}

export function LocationStoreProvider({ children }: { children: ReactNode }) {
  const [savedLocations, setSavedLocations] = useState<SavedAnalyzedLocation[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as {
        savedLocations?: SavedAnalyzedLocation[];
        compareIds?: string[];
      };
      setSavedLocations(parsed.savedLocations ?? []);
      setCompareIds(parsed.compareIds ?? []);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<LocationStoreContextValue>(
    () => ({
      savedLocations,
      compareIds,
      saveLocation: (input) => {
        setSavedLocations((current) => {
          const existingIndex = current.findIndex(
            (location) =>
              location.canonicalAddress === input.canonicalAddress &&
              Math.abs(location.lat - input.lat) < 0.0001 &&
              Math.abs(location.lng - input.lng) < 0.0001
          );
          const next =
            existingIndex >= 0
              ? current.map((location, index) => (index === existingIndex ? input : location))
              : [input, ...current];
          persist(next, compareIds);
          return next;
        });
      },
      removeLocation: (id) => {
        setSavedLocations((current) => {
          const next = current.filter((location) => location.id !== id);
          const nextCompareIds = compareIds.filter((compareId) => compareId !== id);
          setCompareIds(nextCompareIds);
          persist(next, nextCompareIds);
          return next;
        });
      },
      setCompareIncluded: (id, included) => {
        setCompareIds((current) => {
          const next = included
            ? Array.from(new Set([...current, id]))
            : current.filter((entry) => entry !== id);
          persist(savedLocations, next);
          return next;
        });
      },
      isCompared: (id) => compareIds.includes(id)
    }),
    [compareIds, savedLocations]
  );

  return (
    <LocationStoreContext.Provider value={value}>
      {children}
    </LocationStoreContext.Provider>
  );
}

export function useLocationStore() {
  const context = useContext(LocationStoreContext);
  if (!context) {
    throw new Error("useLocationStore must be used within LocationStoreProvider");
  }
  return context;
}
