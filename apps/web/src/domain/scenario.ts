import { bboxIntersects, haversineMeters, type BBox, type LngLat, type RoadFeature } from "@/domain/road";
import type { LinkKind, RoadEdit, VehicleMode } from "@/domain/simulation";

export type { RoadEdit };

export const MIN_LANES = 1;
export const MAX_LANES = 4;
export const MIN_MAXSPEED_KMH = 10;
export const MAX_MAXSPEED_KMH = 90;
export const MAX_EDITS = 400;
export const MAX_EDITS_ERROR = "A scenario can change at most 400 roads.";
export const SNAP_METERS = 40;
export const LINK_ID_BASE = 8_000_000_000_000;

export const MODE_ORDER: readonly VehicleMode[] = ["car", "bus", "truck", "train"];

const MODE_LABEL: Record<VehicleMode, string> = {
  car: "cars",
  bus: "buses",
  truck: "trucks",
  train: "subway trains",
};

const KIND_LABEL: Record<LinkKind, string> = {
  road: "New road",
  highway: "New highway",
  street: "New street",
  subway: "New subway",
  railway: "New railway",
  bridge: "New bridge",
  intersection: "New intersection",
  signal: "New traffic light",
};

export function defaultModes(kind: LinkKind): VehicleMode[] {
  return kind === "subway" || kind === "railway" ? ["train"] : ["car"];
}

export function roadEditError(edit: RoadEdit, _wayBBox: BBox): string | null {
  if (edit.op === "add") return "Draw a link from its two ends.";
  if (!Number.isInteger(edit.wayId) || edit.wayId <= 0) return "Choose a road on the map.";
  if (edit.op === "lanes") {
    if (!Number.isInteger(edit.lanes) || edit.lanes < MIN_LANES || edit.lanes > MAX_LANES) {
      return "Lanes must be a whole number from 1 to 4.";
    }
  }
  if (edit.op === "maxspeed") {
    if (
      !Number.isInteger(edit.maxspeedKmh) ||
      edit.maxspeedKmh < MIN_MAXSPEED_KMH ||
      edit.maxspeedKmh > MAX_MAXSPEED_KMH
    ) {
      return "Speed must be a whole number from 10 to 90 km/h.";
    }
  }
  if (edit.op === "access" && normalizeModes(edit.modes).length === 0) {
    return "Choose at least one kind of vehicle.";
  }
  return null;
}

export const ZAISAN_CHECKPOINT_LABEL = "Zaisan checkpoint: slow signal before 09:00 and after 18:00.";

const WORK_START_MINUTES = 9 * 60;
const WORK_END_MINUTES = 18 * 60;

/** Slow before 09:00 and from 18:00 onward. Office hours are an assumption, not a measured schedule. */
export function describeZaisanWindow(start: string, end: string): string | null {
  const begin = clockMinutes(start);
  const finish = clockMinutes(end);
  if (begin === null || finish === null || finish <= begin) return null;
  const startSlow = zaisanSlow(begin);
  const endSlow = zaisanSlow(finish - 1);
  if (startSlow && endSlow) return null;
  if (!startSlow && !endSlow) return "This window is during work hours, so Zaisan Street keeps its normal signal.";
  return "The slow signal changes when this window crosses 09:00 or 18:00.";
}

function zaisanSlow(minute: number): boolean {
  return minute < WORK_START_MINUTES || minute >= WORK_END_MINUTES;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** One edit per way. A later edit for the same way replaces the earlier one. */
export function commitEdit(
  edits: readonly RoadEdit[],
  edit: RoadEdit,
  wayBBox: BBox,
): { edits: RoadEdit[]; error: string | null } {
  const error = roadEditError(edit, wayBBox);
  if (error) return { edits: [...edits], error };
  const replacing = edits.some((item) => item.wayId === edit.wayId);
  if (!replacing && edits.length >= MAX_EDITS) {
    return { edits: [...edits], error: MAX_EDITS_ERROR };
  }
  const next = edit.op === "access" ? { ...edit, modes: normalizeModes(edit.modes) } : edit;
  return { edits: [...edits.filter((item) => item.wayId !== edit.wayId), next], error: null };
}

export function commitAdd(
  edits: readonly RoadEdit[],
  input: { kind: LinkKind; modes: VehicleMode[]; name?: string; start: LngLat; end: LngLat },
  roads: readonly RoadFeature[],
): { edits: RoadEdit[]; error: string | null } {
  const modes = normalizeModes(input.modes);
  if (modes.length === 0) return { edits: [...edits], error: "Choose at least one kind of vehicle." };
  const start = snapEnd(input.start, roads);
  if (start.error || !start.point) return { edits: [...edits], error: start.error };
  const end = snapEnd(input.end, roads);
  if (end.error || !end.point) return { edits: [...edits], error: end.error };
  if (haversineMeters(start.point, end.point) < 1) {
    return { edits: [...edits], error: "Choose two different ends." };
  }
  if (edits.length >= MAX_EDITS) return { edits: [...edits], error: MAX_EDITS_ERROR };
  const name = input.name?.trim();
  const edit: RoadEdit = {
    wayId: nextLinkId(edits),
    op: "add",
    kind: input.kind,
    modes,
    ...(name ? { name } : {}),
    start: linkEnd(start.point, start.along),
    end: linkEnd(end.point, end.along),
  };
  return { edits: [...edits, edit], error: null };
}

export function removeEdit(edits: readonly RoadEdit[], wayId: number): RoadEdit[] {
  return edits.filter((item) => item.wayId !== wayId);
}

/** How far a click can be from a loaded road and still attach. At least 40 meters, and about 36 screen pixels. */
export function snapReachMeters(zoom: number, latitude: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return Math.max(SNAP_METERS, metersPerPixel * 36);
}

export function snapEnd(
  point: LngLat,
  roads: readonly RoadFeature[],
  district: BBox | null = null,
  reachMeters = SNAP_METERS,
): { point: LngLat | null; along: LngLat | null; error: string | null } {
  let nearestRoad: { road: RoadFeature; distance: number } | null = null;
  for (const road of roads) {
    if (road.coordinates.length < 2) continue;
    if (district && !bboxIntersects(road.bbox, district)) continue;
    for (let index = 1; index < road.coordinates.length; index += 1) {
      const distance = distanceToSegment(point, road.coordinates[index - 1]!, road.coordinates[index]!);
      if (!nearestRoad || distance < nearestRoad.distance) nearestRoad = { road, distance };
    }
  }
  if (!nearestRoad || nearestRoad.distance > reachMeters) {
    return { point: null, along: null, error: "Click a road on the map. The link has to meet an existing road." };
  }
  let vertex = nearestRoad.road.coordinates[0]!;
  let vertexDistance = haversineMeters(point, vertex);
  for (const candidate of nearestRoad.road.coordinates) {
    const distance = haversineMeters(point, candidate);
    if (distance < vertexDistance) {
      vertex = candidate;
      vertexDistance = distance;
    }
  }
  return { point: vertex, along: alongPoint(nearestRoad.road.coordinates, vertex), error: null };
}

/** A second corner on the same road, far enough that the simulation can join the new link. */
function alongPoint(coordinates: readonly LngLat[], vertex: LngLat): LngLat | null {
  let nearestFar: LngLat | null = null;
  let nearestFarDistance = Number.POSITIVE_INFINITY;
  let farthest: LngLat | null = null;
  let farthestDistance = 0;
  for (const candidate of coordinates) {
    const distance = haversineMeters(vertex, candidate);
    if (distance > farthestDistance) {
      farthest = candidate;
      farthestDistance = distance;
    }
    if (distance > SNAP_METERS + 10 && distance < nearestFarDistance) {
      nearestFar = candidate;
      nearestFarDistance = distance;
    }
  }
  return nearestFar ?? (farthestDistance > 1 ? farthest : null);
}

function linkEnd(point: LngLat, along: LngLat | null): { longitude: number; latitude: number; along?: { longitude: number; latitude: number } } {
  return {
    longitude: point[0],
    latitude: point[1],
    ...(along ? { along: { longitude: along[0], latitude: along[1] } } : {}),
  };
}

/** Shape of an edited road, so the simulation can include a road from any district. */
export function withRoadShape(edits: readonly RoadEdit[], roads: readonly RoadFeature[]): RoadEdit[] {
  return edits.map((edit) => {
    if (edit.op === "add") return edit;
    const road = roads.find((item) => item.id === edit.wayId);
    if (!road || road.coordinates.length < 2) return edit;
    const coordinates = road.coordinates.map(([longitude, latitude]) => ({ longitude, latitude }));
    return { ...edit, coordinates };
  });
}

function distanceToSegment(point: LngLat, start: LngLat, end: LngLat): number {
  const lonScale = 111_320 * Math.cos((start[1] * Math.PI) / 180);
  const latScale = 111_320;
  const px = (point[0] - start[0]) * lonScale;
  const py = (point[1] - start[1]) * latScale;
  const bx = (end[0] - start[0]) * lonScale;
  const by = (end[1] - start[1]) * latScale;
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared));
  const snapped: LngLat = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
  return haversineMeters(point, snapped);
}

/** Even split. Any remainder stays with the first selected vehicle type. */
export function tripSplit(total: number, modes: readonly VehicleMode[]): { mode: VehicleMode; count: number }[] {
  const selected = normalizeModes(modes);
  const used = selected.length > 0 ? selected : (["car"] as VehicleMode[]);
  const base = Math.floor(total / used.length);
  const remainder = total - base * used.length;
  return used.map((mode, index) => ({ mode, count: base + (index === 0 ? remainder : 0) }));
}

export function modesInEdits(edits: readonly RoadEdit[]): VehicleMode[] {
  const found = new Set<VehicleMode>();
  for (const edit of edits) {
    if (edit.op === "access" || edit.op === "add") {
      for (const mode of edit.modes) found.add(mode);
    }
  }
  const selected = normalizeModes([...found]);
  return selected.length > 0 ? selected : ["car"];
}

export function scenarioRunError(edits: readonly RoadEdit[]): string | null {
  const wantsTrains = edits.some(
    (edit) => (edit.op === "access" || edit.op === "add") && edit.modes.includes("train"),
  );
  const hasSubway = edits.some(
    (edit) =>
      edit.op === "add" && (edit.kind === "subway" || edit.kind === "railway") && edit.modes.includes("train"),
  );
  if (wantsTrains && !hasSubway) return "Subway trains need a drawn subway link.";
  return null;
}

export function describeEdit(edit: RoadEdit, roadName?: string): string {
  const name = roadName || (edit.op === "add" ? edit.name || KIND_LABEL[edit.kind] : String(edit.wayId));
  if (edit.op === "close") return `Close ${name} for the next run.`;
  if (edit.op === "lanes") return `Set ${name} to ${edit.lanes} ${edit.lanes === 1 ? "lane" : "lanes"}.`;
  if (edit.op === "maxspeed") return `Set the speed limit on ${name} to ${edit.maxspeedKmh} km/h.`;
  if (edit.op === "access") return `Let ${modeList(edit.modes)} use ${name}.`;
  if (edit.op === "park") return `Parked cars block the curb lane of ${name}, two minutes at a time.`;
  if (edit.op === "stall") return `A stalled car blocks one lane of ${name} for the middle of the run.`;
  if (edit.op === "construction") return `Road work on ${name}: one fewer lane, 30 km/h.`;
  return `${edit.name || KIND_LABEL[edit.kind]}, for ${modeList(edit.modes)}.`;
}

export function modeList(modes: readonly VehicleMode[]): string {
  const labels = normalizeModes(modes).map((mode) => MODE_LABEL[mode]);
  if (labels.length <= 1) return labels[0] ?? "cars";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function normalizeModes(modes: readonly VehicleMode[]): VehicleMode[] {
  return MODE_ORDER.filter((mode) => modes.includes(mode));
}

function nextLinkId(edits: readonly RoadEdit[]): number {
  const used = edits.filter((edit) => edit.op === "add").map((edit) => edit.wayId);
  return used.length === 0 ? LINK_ID_BASE + 1 : Math.max(...used) + 1;
}
