import { describe, expect, it } from "vitest";
import { MORNING_PEAK } from "@/domain/preset";
import { bottleneckRoads, simulationConfigError } from "@/domain/run-config";
import type { SegmentMetric } from "@/domain/simulation";

describe("simulationConfigError", () => {
  it("accepts the morning preset", () => {
    expect(simulationConfigError(MORNING_PEAK.config)).toBeNull();
  });

  it("rejects an end time before the start", () => {
    expect(
      simulationConfigError({ ...MORNING_PEAK.config, startTime: "08:00", endTime: "07:30" }),
    ).toMatch(/clock range/);
  });

  it("rejects a window longer than 15 minutes", () => {
    expect(
      simulationConfigError({ ...MORNING_PEAK.config, startTime: "07:00", endTime: "07:30" }),
    ).toMatch(/15 minutes/);
  });

  it("rejects a vehicle count outside 1 to 5000", () => {
    expect(simulationConfigError({ ...MORNING_PEAK.config, demandIntensity: 0 })).toMatch(/1 to 5000/);
    expect(simulationConfigError({ ...MORNING_PEAK.config, demandIntensity: 5001 })).toMatch(/1 to 5000/);
  });
});

describe("bottleneckRoads", () => {
  const names = new Map<number, string>([[10, "Peace Avenue"]]);

  it("keeps only severe segments, slowest first", () => {
    const segments: SegmentMetric[] = [
      { roadId: 10, speedKmh: 12, congestion: "severe" },
      { roadId: 11, speedKmh: 40, congestion: "moderate" },
      { roadId: 12, speedKmh: 4, congestion: "severe" },
    ];
    expect(bottleneckRoads(segments, names)).toEqual([
      { roadId: 12, speedKmh: 4, label: "12" },
      { roadId: 10, speedKmh: 12, label: "Peace Avenue" },
    ]);
  });

  it("returns nothing when the frame has no severe roads", () => {
    const segments: SegmentMetric[] = [{ roadId: 10, speedKmh: 40, congestion: "heavy" }];
    expect(bottleneckRoads(segments, names)).toEqual([]);
  });
});
