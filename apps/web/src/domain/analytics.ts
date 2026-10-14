import { MAX_VEHICLES, MIN_VEHICLES } from "@/domain/run-config";
import type { SimulationFrame } from "@/domain/simulation";

export type RoadRank = {
  roadId: number;
  severeSeconds: number;
  lowestSpeedKmh: number;
  label: string;
};

export type BottleneckSample = {
  timestamp: string;
  count: number;
};

/** Roads that were severe, longest first, then slowest. */
export function rankSevereRoads(
  frames: readonly SimulationFrame[],
  names: ReadonlyMap<number, string>,
): RoadRank[] {
  const stats = new Map<number, { seconds: number; lowest: number }>();
  for (const frame of frames) {
    const seen = new Set<number>();
    for (const segment of frame.segments) {
      if (segment.congestion !== "severe" || seen.has(segment.roadId)) continue;
      seen.add(segment.roadId);
      const current = stats.get(segment.roadId);
      if (!current) {
        stats.set(segment.roadId, { seconds: 1, lowest: segment.speedKmh });
        continue;
      }
      current.seconds += 1;
      current.lowest = Math.min(current.lowest, segment.speedKmh);
    }
  }
  return [...stats.entries()]
    .map(([roadId, stat]) => ({
      roadId,
      severeSeconds: stat.seconds,
      lowestSpeedKmh: stat.lowest,
      label: names.get(roadId) || String(roadId),
    }))
    .sort(
      (a, b) => b.severeSeconds - a.severeSeconds || a.lowestSpeedKmh - b.lowestSpeedKmh || a.roadId - b.roadId,
    );
}

export function severeSecondsByRoad(frames: readonly SimulationFrame[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const rank of rankSevereRoads(frames, new Map())) counts.set(rank.roadId, rank.severeSeconds);
  return counts;
}

/** Severe-road count for each recorded second. Seconds with none stay at zero. */
export function bottleneckSeries(frames: readonly SimulationFrame[]): BottleneckSample[] {
  return frames.map((frame) => ({
    timestamp: frame.timestamp,
    count: frame.segments.filter((segment) => segment.congestion === "severe").length,
  }));
}

/** A count file is `{ "vehicles": <whole number> }`. Anything else is refused. */
export function parseVehicleCount(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const vehicles = (value as { vehicles?: unknown }).vehicles;
  if (!Number.isInteger(vehicles) || (vehicles as number) < MIN_VEHICLES || (vehicles as number) > MAX_VEHICLES) {
    return null;
  }
  return vehicles as number;
}
