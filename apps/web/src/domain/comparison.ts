import type { SimulationFrame } from "@/domain/simulation";

export type SevereComparison = {
  timestamp: string;
  baseline: number;
  scenario: number;
  /** Scenario severe roads minus baseline severe roads for this second. */
  difference: number;
};

/** Seconds that exist in both runs. A missing second is left out so it is not counted as zero. */
export function compareSevereCounts(
  baseline: readonly SimulationFrame[],
  scenario: readonly SimulationFrame[],
): SevereComparison[] {
  const base = severeByTimestamp(baseline);
  const edited = severeByTimestamp(scenario);
  const timestamps = [...base.keys()].filter((timestamp) => edited.has(timestamp)).sort();
  return timestamps.map((timestamp) => {
    const baselineCount = base.get(timestamp) ?? 0;
    const scenarioCount = edited.get(timestamp) ?? 0;
    return {
      timestamp,
      baseline: baselineCount,
      scenario: scenarioCount,
      difference: scenarioCount - baselineCount,
    };
  });
}

export function describeSevereDifference(rows: readonly SevereComparison[]): string {
  if (rows.length === 0) return "The two runs share no timestamps to compare.";
  const baseline = rows.reduce((total, row) => total + row.baseline, 0);
  const scenario = rows.reduce((total, row) => total + row.scenario, 0);
  const delta = scenario - baseline;
  if (delta === 0) return "Severe-road seconds match the baseline.";
  const more = delta > 0;
  const amount = Math.abs(delta);
  const noun = amount === 1 ? "severe-road second" : "severe-road seconds";
  const lead = more
    ? `The scenario has ${amount} more ${noun} than the baseline.`
    : `The scenario has ${amount} fewer ${noun} than the baseline.`;
  const peak = rows.reduce((best, row) => {
    const score = more ? row.difference : -row.difference;
    const bestScore = more ? best.difference : -best.difference;
    return score > bestScore ? row : best;
  });
  const gap = Math.abs(peak.difference);
  if (gap === 0) return lead;
  const roads = gap === 1 ? "severe road" : "severe roads";
  const direction = peak.difference > 0 ? "more" : "fewer";
  return `${lead} The largest gap is ${peak.timestamp}, with ${gap} ${direction} ${roads}.`;
}

function severeByTimestamp(frames: readonly SimulationFrame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const frame of frames) {
    counts.set(
      frame.timestamp,
      frame.segments.filter((segment) => segment.congestion === "severe").length,
    );
  }
  return counts;
}
