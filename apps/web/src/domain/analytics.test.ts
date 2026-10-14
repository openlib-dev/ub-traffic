import { describe, expect, it } from "vitest";
import { bottleneckSeries, parseVehicleCount, rankSevereRoads } from "@/domain/analytics";
import type { SimulationFrame } from "@/domain/simulation";

function frame(timestamp: string, severe: { roadId: number; speedKmh: number }[]): SimulationFrame {
  return {
    timestamp,
    vehicles: [],
    segments: severe.map((segment) => ({ ...segment, congestion: "severe" as const })),
  };
}

describe("rankSevereRoads", () => {
  it("ranks by severe seconds, then by the lowest speed", () => {
    const frames = [
      frame("07:30:00", [
        { roadId: 1, speedKmh: 8 },
        { roadId: 2, speedKmh: 4 },
      ]),
      frame("07:30:01", [
        { roadId: 1, speedKmh: 6 },
        { roadId: 3, speedKmh: 3 },
      ]),
    ];
    const names = new Map<number, string>([[1, "Peace Avenue"]]);
    expect(rankSevereRoads(frames, names)).toEqual([
      { roadId: 1, severeSeconds: 2, lowestSpeedKmh: 6, label: "Peace Avenue" },
      { roadId: 3, severeSeconds: 1, lowestSpeedKmh: 3, label: "3" },
      { roadId: 2, severeSeconds: 1, lowestSpeedKmh: 4, label: "2" },
    ]);
  });
});

describe("bottleneckSeries", () => {
  it("keeps a zero for a second with no severe roads", () => {
    expect(bottleneckSeries([frame("07:30:00", []), frame("07:30:01", [{ roadId: 1, speedKmh: 5 }])])).toEqual([
      { timestamp: "07:30:00", count: 0 },
      { timestamp: "07:30:01", count: 1 },
    ]);
  });
});

describe("parseVehicleCount", () => {
  it("accepts a whole vehicle count and refuses anything else", () => {
    expect(parseVehicleCount({ vehicles: 1200 })).toBe(1200);
    expect(parseVehicleCount({ vehicles: 0 })).toBeNull();
    expect(parseVehicleCount({ vehicles: 1.5 })).toBeNull();
    expect(parseVehicleCount({ cars: 10 })).toBeNull();
  });
});
