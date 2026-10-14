import { describe, expect, it } from "vitest";
import { compareBottlenecks, effectPercent, parseSavedRecord, sharePercent } from "@/domain/saved-result";
import type { SavedRoad } from "@/domain/saved-result";

const peace: SavedRoad = { roadId: 1, severeSeconds: 90, lowestSpeedKmh: 8, label: "Peace Avenue" };
const ring: SavedRoad = { roadId: 2, severeSeconds: 100, lowestSpeedKmh: 6, label: "Ring" };

describe("bottleneck percents", () => {
  it("gives a road its share of the severe seconds", () => {
    expect(sharePercent(90, 300)).toBe(30);
    expect(sharePercent(0, 300)).toBe(0);
    expect(sharePercent(10, 0)).toBe(0);
  });

  it("reports the percent change against the reference", () => {
    expect(effectPercent(100, 140)).toEqual({ kind: "percent", percent: 40 });
    expect(effectPercent(100, 0)).toEqual({ kind: "percent", percent: -100 });
  });

  it("labels a road that was not severe before as a new bottleneck", () => {
    expect(effectPercent(0, 40)).toEqual({ kind: "new" });
  });

  it("ranks the largest bottlenecks and keeps the changed share", () => {
    const rows = compareBottlenecks([ring], [peace, { ...ring, severeSeconds: 140 }], 230);
    expect(rows[0]).toMatchObject({ roadId: 2, sharePercent: 61, effect: { kind: "percent", percent: 40 } });
    expect(rows[1]).toMatchObject({ roadId: 1, effect: { kind: "new" }, sharePercent: 39 });
  });
});

describe("parseSavedRecord", () => {
  it("accepts a compact result and refuses a negative severe count", () => {
    const saved = {
      id: "abcdef12",
      name: "Morning",
      createdAt: "2026-10-13T12:00:00Z",
      startTime: "07:30",
      endTime: "07:45",
      demandIntensity: 2000,
      seed: 42,
      commuteAttractors: true,
      edits: [],
      summary: {
        totalSevereSeconds: 90,
        roads: [peace],
        series: [{ timestamp: "07:30:00", count: 1 }],
      },
    };
    expect(parseSavedRecord(saved)?.name).toBe("Morning");
    expect(parseSavedRecord({ ...saved, summary: { ...saved.summary, totalSevereSeconds: -1 } })).toBeNull();
    expect(parseSavedRecord({ ...saved, name: "   " })).toBeNull();
  });
});
