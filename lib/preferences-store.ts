import { defaultPreferences } from "@/lib/constants";
import { UserPreferences } from "@/lib/types/domain";

export const PREFERENCES_COOKIE_KEY = "good-area-preferences";

export function serializePreferences(preferences: UserPreferences) {
  return encodeURIComponent(JSON.stringify(preferences));
}

export function parseStoredPreferences(value?: string | null): UserPreferences {
  if (!value) return defaultPreferences;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as UserPreferences;
    const migratedSavedPlaces = (parsed.savedPlaces ?? defaultPreferences.savedPlaces).filter(
      (place) => !["saved-work", "saved-sister"].includes(place.id)
    );
    return {
      ...defaultPreferences,
      ...parsed,
      scoringWeights: {
        ...defaultPreferences.scoringWeights,
        ...(parsed.scoringWeights ?? {})
      },
      hardRules: parsed.hardRules ?? defaultPreferences.hardRules,
      savedPlaces: migratedSavedPlaces
    };
  } catch {
    return defaultPreferences;
  }
}
