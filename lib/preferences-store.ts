import { defaultAppSettings, defaultPreferences } from "@/lib/constants";
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
      settings: {
        ...defaultAppSettings,
        ...(parsed.settings ?? {}),
        scoring: {
          ...defaultAppSettings.scoring,
          ...(parsed.settings?.scoring ?? {})
        },
        safety: {
          ...defaultAppSettings.safety,
          ...(parsed.settings?.safety ?? {}),
          categoryEmphasis: {
            ...defaultAppSettings.safety.categoryEmphasis,
            ...(parsed.settings?.safety?.categoryEmphasis ?? {})
          }
        },
        travel: {
          ...defaultAppSettings.travel,
          ...(parsed.settings?.travel ?? {}),
          amenityWalkCaps: {
            ...defaultAppSettings.travel.amenityWalkCaps,
            ...(parsed.settings?.travel?.amenityWalkCaps ?? {})
          }
        },
        mustHaves: {
          ...defaultAppSettings.mustHaves,
          ...(parsed.settings?.mustHaves ?? {}),
          poiRules: {
            ...defaultAppSettings.mustHaves.poiRules,
            ...(parsed.settings?.mustHaves as { poiRules?: typeof defaultAppSettings.mustHaves.poiRules } | undefined)
              ?.poiRules
          },
          personalPlaces: {
            ...defaultAppSettings.mustHaves.personalPlaces,
            ...(parsed.settings?.mustHaves as { personalPlaces?: typeof defaultAppSettings.mustHaves.personalPlaces } | undefined)
              ?.personalPlaces
          }
        },
        dataReliability: {
          ...defaultAppSettings.dataReliability,
          ...(parsed.settings?.dataReliability ?? {}),
          providerToggles: {
            ...defaultAppSettings.dataReliability.providerToggles,
            ...(parsed.settings?.dataReliability?.providerToggles ?? {})
          }
        },
        mapBrowse: {
          ...defaultAppSettings.mapBrowse,
          ...(parsed.settings?.mapBrowse ?? {})
        },
        ux: {
          ...defaultAppSettings.ux,
          ...(parsed.settings?.ux ?? {})
        }
      },
      hardRules: parsed.hardRules ?? defaultPreferences.hardRules,
      savedPlaces: migratedSavedPlaces
    };
  } catch {
    return defaultPreferences;
  }
}
