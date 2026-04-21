import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyzeLocation = vi.fn();
const mockGetServerPreferences = vi.fn();

vi.mock("@/lib/demo-service", () => ({
  analyzeLocation: mockAnalyzeLocation
}));

vi.mock("@/lib/server-preferences", () => ({
  getServerPreferences: mockGetServerPreferences
}));

describe("GET /api/location-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes server preferences and parsed coordinates into analyzeLocation", async () => {
    const preferences = {
      id: "test-user",
      scoringWeights: {
        safety: 40,
        accessibility: 35,
        affordability: 0,
        homeFit: 0,
        lifestyle: 25
      },
      hardRules: [],
      savedPlaces: [
        {
          id: "work",
          label: "Work",
          category: "work",
          address: "Office",
          lat: 34.05,
          lng: -118.24,
          includeInScoring: true
        }
      ]
    };
    mockGetServerPreferences.mockResolvedValue(preferences);
    mockAnalyzeLocation.mockResolvedValue({
      property: { id: "p1" },
      score: { overallScore: 72 }
    });

    const { GET } = await import("@/app/api/location-analysis/route");
    const response = await GET(
      new Request(
        "http://localhost/api/location-analysis?address=123+Main+St&lat=34.0522&lng=-118.2437&label=DTLA"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      result: {
        property: { id: "p1" },
        score: { overallScore: 72 }
      }
    });
    expect(mockAnalyzeLocation).toHaveBeenCalledWith({
      address: "123 Main St",
      lat: 34.0522,
      lng: -118.2437,
      label: "DTLA",
      preferences
    });
  });

  it("treats blank/invalid coordinates as undefined", async () => {
    mockGetServerPreferences.mockResolvedValue({
      id: "test-user",
      scoringWeights: {
        safety: 40,
        accessibility: 35,
        affordability: 0,
        homeFit: 0,
        lifestyle: 25
      },
      hardRules: [],
      savedPlaces: []
    });
    mockAnalyzeLocation.mockResolvedValue({
      property: { id: "p2" },
      score: { overallScore: 61 }
    });

    const { GET } = await import("@/app/api/location-analysis/route");
    await GET(
      new Request(
        "http://localhost/api/location-analysis?address=Unknown&lat=&lng=not-a-number"
      )
    );

    expect(mockAnalyzeLocation).toHaveBeenCalledWith({
      address: "Unknown",
      lat: undefined,
      lng: undefined,
      label: undefined,
      preferences: expect.any(Object)
    });
  });
});
