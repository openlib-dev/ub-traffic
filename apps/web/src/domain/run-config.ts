import { MORNING_PEAK } from "@/domain/preset";
import type { RoadEdit, SegmentMetric, SimulationConfig } from "@/domain/simulation";

export const MIN_WINDOW_MINUTES = 1;
export const MAX_WINDOW_MINUTES = 15;
export const MIN_VEHICLES = 1;
export const MAX_VEHICLES = 5000;
export const MAX_SEED = 2_147_483_647;

export type RunInputs = {
  startTime: string;
  endTime: string;
  demandIntensity: number;
  seed: number;
  edits?: RoadEdit[];
  commuteAttractors?: boolean;
};

export function simulationConfigError(input: RunInputs): string | null {
  const begin = clockMinutes(input.startTime);
  const finish = clockMinutes(input.endTime);
  if (begin === null || finish === null || finish <= begin) {
    return "Use a clock range such as 07:30–07:45.";
  }
  const minutes = finish - begin;
  if (minutes < MIN_WINDOW_MINUTES) return "The window must be at least 1 minute.";
  if (minutes > MAX_WINDOW_MINUTES) return "The window must be at most 15 minutes.";
  if (!Number.isInteger(input.demandIntensity) || input.demandIntensity < MIN_VEHICLES || input.demandIntensity > MAX_VEHICLES) {
    return `Vehicles must be a whole number from 1 to ${MAX_VEHICLES}.`;
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > MAX_SEED) {
    return "Seed must be a whole number from 0 to 2147483647.";
  }
  return null;
}

export function configFromInputs(input: RunInputs): SimulationConfig {
  return {
    scenarioId: MORNING_PEAK.config.scenarioId,
    startTime: input.startTime,
    endTime: input.endTime,
    demandIntensity: input.demandIntensity,
    speed: 1,
    seed: input.seed,
    edits: input.edits ?? [],
    commuteAttractors: input.commuteAttractors ?? true,
  };
}

export type BottleneckRoad = {
  roadId: number;
  speedKmh: number;
  label: string;
};

/** Severe segments of this frame, slowest first. Other levels are not bottlenecks. */
export function bottleneckRoads(
  segments: readonly SegmentMetric[],
  names: ReadonlyMap<number, string>,
): BottleneckRoad[] {
  return segments
    .filter((segment) => segment.congestion === "severe")
    .map((segment) => ({
      roadId: segment.roadId,
      speedKmh: segment.speedKmh,
      label: names.get(segment.roadId) || String(segment.roadId),
    }))
    .sort((a, b) => a.speedKmh - b.speedKmh || a.roadId - b.roadId);
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
