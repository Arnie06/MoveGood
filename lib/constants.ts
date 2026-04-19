import { ScoreWeights, UserPreferences } from "@/lib/types/domain";

export const defaultWeights: ScoreWeights = {
  safety: 40,
  accessibility: 35,
  affordability: 0,
  homeFit: 0,
  lifestyle: 25
};

export const defaultPreferences: UserPreferences = {
  id: "demo-user",
  scoringWeights: defaultWeights,
  hardRules: [
    {
      id: "hr-work-peak",
      label: "Longest peak drive to any saved place within 45 minutes",
      metric: "work-peak-max",
      value: 45
    },
    {
      id: "hr-grocery-walk",
      label: "Grocery within 20 minutes walking",
      metric: "grocery-walk-max",
      value: 20
    },
    {
      id: "hr-safety",
      label: "Safety score at least 55",
      metric: "safety-min",
      value: 55
    }
  ],
  savedPlaces: []
};
