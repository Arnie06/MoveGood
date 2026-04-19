"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { defaultPreferences } from "@/lib/constants";
import {
  PREFERENCES_COOKIE_KEY,
  parseStoredPreferences,
  serializePreferences
} from "@/lib/preferences-store";
import { UserPreferences } from "@/lib/types/domain";

interface PreferencesContextValue {
  preferences: UserPreferences;
  setPreferences: (preferences: UserPreferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const STORAGE_KEY = "good-area-preferences-v2-la";

function persistPreferences(preferences: UserPreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  document.cookie = `${PREFERENCES_COOKIE_KEY}=${serializePreferences(
    preferences
  )}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<UserPreferences>(defaultPreferences);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      persistPreferences(defaultPreferences);
      return;
    }

    try {
      const parsed = parseStoredPreferences(encodeURIComponent(stored));
      setPreferencesState(parsed);
      persistPreferences(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      persistPreferences(defaultPreferences);
    }
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      setPreferences: (next: UserPreferences) => {
        setPreferencesState(next);
        persistPreferences(next);
      }
    }),
    [preferences]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
