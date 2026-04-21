import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadPersistedCrimeIncidents = vi.fn();
const mockGetCrimeIncidents = vi.fn();

vi.mock("@/lib/crime-data", () => ({
  readPersistedCrimeIncidents: mockReadPersistedCrimeIncidents
}));

vi.mock("@/lib/providers/mock", () => ({
  MockSafetyProvider: class MockSafetyProvider {
    async getCrimeIncidents(input: { lat: number; lng: number; radiusMiles: number }) {
      return mockGetCrimeIncidents(input);
    }
  }
}));

describe("GET /api/map-crime local-only behavior", () => {
  const previousLocalOnly = process.env.LOCAL_ONLY_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOCAL_ONLY_MODE = previousLocalOnly;
  });

  it("does not synthesize fallback incidents in local-only mode", async () => {
    process.env.LOCAL_ONLY_MODE = "true";
    mockReadPersistedCrimeIncidents.mockResolvedValue([]);
    mockGetCrimeIncidents.mockResolvedValue([
      {
        id: "mock-1",
        geoId: "x",
        lat: 34.05,
        lng: -118.24,
        category: "property",
        label: "Mock",
        occurredAt: "2026-04-20T00:00:00.000Z",
        sourceName: "Mock"
      }
    ]);

    const { GET } = await import("@/app/api/map-crime/route");
    const response = await GET(
      new Request("http://localhost/api/map-crime?west=-118.3&south=34.0&east=-118.2&north=34.1") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.incidents).toEqual([]);
    expect(mockGetCrimeIncidents).not.toHaveBeenCalled();
  });

  it("uses mock fallback incidents when not in local-only mode", async () => {
    process.env.LOCAL_ONLY_MODE = "false";
    mockReadPersistedCrimeIncidents.mockResolvedValue([]);
    mockGetCrimeIncidents.mockResolvedValue([
      {
        id: "mock-1",
        geoId: "x",
        lat: 34.05,
        lng: -118.24,
        category: "property",
        label: "Mock",
        occurredAt: "2026-04-20T00:00:00.000Z",
        sourceName: "Mock"
      }
    ]);

    const { GET } = await import("@/app/api/map-crime/route");
    const response = await GET(
      new Request("http://localhost/api/map-crime?west=-118.3&south=34.0&east=-118.2&north=34.1") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.incidents).toHaveLength(1);
    expect(mockGetCrimeIncidents).toHaveBeenCalledTimes(1);
  });
});
