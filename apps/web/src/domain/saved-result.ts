import { bottleneckSeries, rankSevereRoads } from "@/domain/analytics";
import { compareSevereCounts, type SevereComparison } from "@/domain/comparison";
import type { RoadEdit, SimulationConfig, SimulationFrame } from "@/domain/simulation";

export const MAX_SAVED_NAME = 80;

export type SavedRoad = {
  roadId: number;
  severeSeconds: number;
  lowestSpeedKmh: number;
  label: string;
};

export type SavedSeriesPoint = {
  timestamp: string;
  count: number;
};

export type SavedSummary = {
  totalSevereSeconds: number;
  roads: SavedRoad[];
  series: SavedSeriesPoint[];
};

export type SavedSettings = {
  startTime: string;
  endTime: string;
  demandIntensity: number;
  seed: number;
  commuteAttractors: boolean;
  edits: RoadEdit[];
};

export type SavedRecord = SavedSettings & {
  id: string;
  name: string;
  createdAt: string;
  summary: SavedSummary;
};

export type SavedListItem = {
  id: string;
  name: string;
  createdAt: string;
  startTime: string;
  endTime: string;
  demandIntensity: number;
  commuteAttractors: boolean;
  editCount: number;
  totalSevereSeconds: number;
};

export type BottleneckEffect =
  | { kind: "percent"; percent: number }
  | { kind: "new" };

export type BottleneckRow = {
  roadId: number;
  label: string;
  severeSeconds: number;
  lowestSpeedKmh: number;
  sharePercent: number;
  referenceSeconds: number;
  changedSeconds: number;
  effect: BottleneckEffect | null;
};

export function buildSavedSummary(
  frames: readonly SimulationFrame[],
  names: ReadonlyMap<number, string>,
): SavedSummary {
  const roads = rankSevereRoads(frames, names).map((road) => ({
    roadId: road.roadId,
    severeSeconds: road.severeSeconds,
    lowestSpeedKmh: road.lowestSpeedKmh,
    label: road.label,
  }));
  const series = bottleneckSeries(frames);
  return {
    totalSevereSeconds: roads.reduce((total, road) => total + road.severeSeconds, 0),
    roads,
    series,
  };
}

export function sameClock(left: Pick<SavedSettings, "startTime" | "endTime">, right: Pick<SavedSettings, "startTime" | "endTime">): boolean {
  return left.startTime === right.startTime && left.endTime === right.endTime;
}

export function seriesComparison(reference: readonly SavedSeriesPoint[], changed: readonly SavedSeriesPoint[]): SevereComparison[] {
  return compareSevereCounts(seriesFrames(reference), seriesFrames(changed));
}

/** Share of this run's severe-road seconds. A zero total is 0%. */
export function sharePercent(seconds: number, total: number): number {
  if (total <= 0 || seconds <= 0) return 0;
  return Math.round((100 * seconds) / total);
}

/**
 * Percent change in severe seconds. A road that was not severe in the reference is a new bottleneck.
 */
export function effectPercent(referenceSeconds: number, changedSeconds: number): BottleneckEffect {
  if (referenceSeconds <= 0) return { kind: "new" };
  return {
    kind: "percent",
    percent: Math.round((100 * (changedSeconds - referenceSeconds)) / referenceSeconds),
  };
}

export function listBottlenecks(roads: readonly SavedRoad[], total: number): BottleneckRow[] {
  return roads.map((road) => ({
    roadId: road.roadId,
    label: road.label,
    severeSeconds: road.severeSeconds,
    lowestSpeedKmh: road.lowestSpeedKmh,
    sharePercent: sharePercent(road.severeSeconds, total),
    referenceSeconds: road.severeSeconds,
    changedSeconds: road.severeSeconds,
    effect: null,
  }));
}

/** Biggest bottlenecks across both runs, with the changed run's share and the effect versus the reference. */
export function compareBottlenecks(reference: readonly SavedRoad[], changed: readonly SavedRoad[], changedTotal: number): BottleneckRow[] {
  const base = new Map(reference.map((road) => [road.roadId, road]));
  const next = new Map(changed.map((road) => [road.roadId, road]));
  const ids = new Set<number>([...base.keys(), ...next.keys()]);
  const rows: BottleneckRow[] = [];
  for (const roadId of ids) {
    const before = base.get(roadId);
    const after = next.get(roadId);
    const referenceSeconds = before?.severeSeconds ?? 0;
    const changedSeconds = after?.severeSeconds ?? 0;
    if (referenceSeconds <= 0 && changedSeconds <= 0) continue;
    rows.push({
      roadId,
      label: after?.label || before?.label || String(roadId),
      severeSeconds: Math.max(referenceSeconds, changedSeconds),
      lowestSpeedKmh: Math.min(after?.lowestSpeedKmh ?? Number.POSITIVE_INFINITY, before?.lowestSpeedKmh ?? Number.POSITIVE_INFINITY),
      sharePercent: sharePercent(changedSeconds, changedTotal),
      referenceSeconds,
      changedSeconds,
      effect: effectPercent(referenceSeconds, changedSeconds),
    });
  }
  return rows.sort(
    (a, b) => b.severeSeconds - a.severeSeconds || a.lowestSpeedKmh - b.lowestSpeedKmh || a.roadId - b.roadId,
  );
}

export function severeDelta(reference: readonly SavedRoad[], changed: readonly SavedRoad[]): Map<number, number> {
  const delta = new Map<number, number>();
  const base = new Map(reference.map((road) => [road.roadId, road.severeSeconds]));
  const next = new Map(changed.map((road) => [road.roadId, road.severeSeconds]));
  for (const roadId of new Set([...base.keys(), ...next.keys()])) {
    const difference = (next.get(roadId) ?? 0) - (base.get(roadId) ?? 0);
    if (difference !== 0) delta.set(roadId, difference);
  }
  return delta;
}

export function parseSavedRecord(value: unknown): SavedRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const settings = parseSettings(record);
  const summary = parseSummary(record.summary);
  if (!settings || !summary) return null;
  if (typeof record.id !== "string" || !/^[a-f0-9]{8,32}$/.test(record.id)) return null;
  if (typeof record.name !== "string" || record.name.trim().length === 0 || record.name.trim().length > MAX_SAVED_NAME) return null;
  if (typeof record.createdAt !== "string" || Number.isNaN(Date.parse(record.createdAt))) return null;
  return { id: record.id, name: record.name.trim(), createdAt: record.createdAt, ...settings, summary };
}

export function parseSavedList(value: unknown): SavedListItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: SavedListItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") return null;
    if (typeof record.createdAt !== "string" || typeof record.startTime !== "string" || typeof record.endTime !== "string") return null;
    if (!Number.isInteger(record.demandIntensity) || !Number.isInteger(record.editCount) || !Number.isInteger(record.totalSevereSeconds)) {
      return null;
    }
    if (typeof record.commuteAttractors !== "boolean") return null;
    items.push({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      startTime: record.startTime,
      endTime: record.endTime,
      demandIntensity: record.demandIntensity as number,
      commuteAttractors: record.commuteAttractors,
      editCount: record.editCount as number,
      totalSevereSeconds: record.totalSevereSeconds as number,
    });
  }
  return items;
}

export function savedRequestBody(name: string, config: SimulationConfig, frames: readonly SimulationFrame[], names: ReadonlyMap<number, string>) {
  return {
    name: name.trim(),
    startTime: config.startTime,
    endTime: config.endTime,
    demandIntensity: config.demandIntensity,
    seed: config.seed,
    commuteAttractors: config.commuteAttractors ?? true,
    edits: config.edits ?? [],
    summary: buildSavedSummary(frames, names),
  };
}

function seriesFrames(series: readonly SavedSeriesPoint[]): SimulationFrame[] {
  return series.map((point) => ({
    timestamp: point.timestamp,
    vehicles: [],
    segments: Array.from({ length: point.count }, (_, index) => ({
      roadId: index + 1,
      speedKmh: 1,
      congestion: "severe" as const,
    })),
  }));
}

function parseSettings(record: Record<string, unknown>): SavedSettings | null {
  if (!isClock(record.startTime) || !isClock(record.endTime)) return null;
  if (!Number.isInteger(record.demandIntensity) || (record.demandIntensity as number) < 1 || (record.demandIntensity as number) > 5000) {
    return null;
  }
  if (!Number.isInteger(record.seed) || (record.seed as number) < 0 || (record.seed as number) > 2_147_483_647) return null;
  if (typeof record.commuteAttractors !== "boolean") return null;
  if (!Array.isArray(record.edits) || record.edits.length > 50) return null;
  return {
    startTime: record.startTime,
    endTime: record.endTime,
    demandIntensity: record.demandIntensity as number,
    seed: record.seed as number,
    commuteAttractors: record.commuteAttractors,
    edits: record.edits as RoadEdit[],
  };
}

function parseSummary(value: unknown): SavedSummary | null {
  if (!value || typeof value !== "object") return null;
  const summary = value as Record<string, unknown>;
  if (!Number.isInteger(summary.totalSevereSeconds) || (summary.totalSevereSeconds as number) < 0) return null;
  if (!Array.isArray(summary.roads) || summary.roads.length > 20_000) return null;
  if (!Array.isArray(summary.series) || summary.series.length > 900) return null;
  const roads: SavedRoad[] = [];
  for (const item of summary.roads) {
    const road = parseRoad(item);
    if (!road) return null;
    roads.push(road);
  }
  const series: SavedSeriesPoint[] = [];
  for (const item of summary.series) {
    if (!item || typeof item !== "object") return null;
    const point = item as Record<string, unknown>;
    if (typeof point.timestamp !== "string" || !/^\d{2}:\d{2}:\d{2}$/.test(point.timestamp)) return null;
    if (!Number.isInteger(point.count) || (point.count as number) < 0) return null;
    series.push({ timestamp: point.timestamp, count: point.count as number });
  }
  return { totalSevereSeconds: summary.totalSevereSeconds as number, roads, series };
}

function parseRoad(value: unknown): SavedRoad | null {
  if (!value || typeof value !== "object") return null;
  const road = value as Record<string, unknown>;
  if (!Number.isInteger(road.roadId) || (road.roadId as number) <= 0) return null;
  if (!Number.isInteger(road.severeSeconds) || (road.severeSeconds as number) < 0) return null;
  if (typeof road.lowestSpeedKmh !== "number" || !Number.isFinite(road.lowestSpeedKmh) || road.lowestSpeedKmh < 0) return null;
  if (typeof road.label !== "string") return null;
  return {
    roadId: road.roadId as number,
    severeSeconds: road.severeSeconds as number,
    lowestSpeedKmh: road.lowestSpeedKmh,
    label: road.label,
  };
}

function isClock(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
