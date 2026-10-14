import { describe, expect, it } from "vitest";
import { compareSevereCounts, describeSevereDifference } from "@/domain/comparison";
import type { SimulationFrame } from "@/domain/simulation";

function frame(timestamp: string, severeRoads: number[]): SimulationFrame {
  return {
    timestamp,
    vehicles: [],
    segments: [
      ...severeRoads.map((roadId) => ({ roadId, speedKmh: 5, congestion: "severe" as const })),
      { roadId: 9000, speedKmh: 40, congestion: "free" as const },
    ],
  };
}

describe("compareSevereCounts", () => {
  it("counts severe roads on shared seconds", () => {
    const rows = compareSevereCounts(
      [frame("07:30:00", [1]), frame("07:30:01", [1, 2])],
      [frame("07:30:00", [1, 2, 3]), frame("07:30:01", [1])],
    );
    expect(rows).toEqual([
      { timestamp: "07:30:00", baseline: 1, scenario: 3, difference: 2 },
      { timestamp: "07:30:01", baseline: 2, scenario: 1, difference: -1 },
    ]);
  });

  it("leaves out a second that only one run recorded", () => {
    const rows = compareSevereCounts(
      [frame("07:30:00", [1]), frame("07:30:02", [4])],
      [frame("07:30:00", [1, 2])],
    );
    expect(rows).toEqual([{ timestamp: "07:30:00", baseline: 1, scenario: 2, difference: 1 }]);
  });
});

describe("describeSevereDifference", () => {
  it("says when the totals match", () => {
    expect(
      describeSevereDifference([{ timestamp: "07:30:00", baseline: 2, scenario: 2, difference: 0 }]),
    ).toBe("Severe-road seconds match the baseline.");
  });

  it("names the second with the largest extra severe count", () => {
    expect(
      describeSevereDifference([
        { timestamp: "07:30:00", baseline: 1, scenario: 2, difference: 1 },
        { timestamp: "07:30:01", baseline: 0, scenario: 4, difference: 4 },
      ]),
    ).toBe(
      "The scenario has 5 more severe-road seconds than the baseline. The largest gap is 07:30:01, with 4 more severe roads.",
    );
  });

  it("names the second with the largest drop", () => {
    expect(
      describeSevereDifference([{ timestamp: "07:31:00", baseline: 3, scenario: 1, difference: -2 }]),
    ).toBe(
      "The scenario has 2 fewer severe-road seconds than the baseline. The largest gap is 07:31:00, with 2 fewer severe roads.",
    );
  });
});
