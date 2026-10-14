import type { RoadFeature } from "@/domain/road";
import { LINK_ID_BASE, MAX_EDITS, MAX_EDITS_ERROR, SNAP_METERS, snapEnd, type RoadEdit } from "@/domain/scenario";
import type { LinkKind, VehicleMode } from "@/domain/simulation";

export type DrawTool =
  | "select"
  | "road"
  | "oneway"
  | "highway"
  | "street"
  | "subway"
  | "railway"
  | "bridge"
  | "intersection"
  | "signal"
  | "eraser";

export type LngLat = [number, number];

const SEPARATE = new Set<DrawTool>(["subway", "railway", "bridge"]);
const POINT = new Set<DrawTool>(["intersection", "signal"]);

export function isDrawTool(tool: DrawTool): boolean {
  return tool !== "select" && tool !== "eraser";
}

export function toolKind(tool: DrawTool): LinkKind {
  if (tool === "oneway" || tool === "select" || tool === "eraser") return "road";
  return tool;
}

export function toolModes(tool: DrawTool): VehicleMode[] {
  if (tool === "subway" || tool === "railway") return ["train"];
  if (tool === "highway") return ["car", "bus", "truck"];
  return ["car"];
}

export function toolDefaults(tool: DrawTool): { lanes: number; maxspeedKmh: number; stops?: number } {
  if (tool === "highway") return { lanes: 2, maxspeedKmh: 80 };
  if (tool === "street") return { lanes: 1, maxspeedKmh: 30 };
  if (tool === "subway") return { lanes: 1, maxspeedKmh: 40, stops: 2 };
  return { lanes: 2, maxspeedKmh: 50 };
}

export type SnapResult = {
  point: LngLat;
  along: LngLat | null;
  snapped: boolean;
  error: string | null;
};

/** Snap a canvas point. Separate links ignore surface roads. Alt keeps the raw point. */
export function snapDrawPoint(
  point: LngLat,
  roads: readonly RoadFeature[],
  edits: readonly RoadEdit[],
  tool: DrawTool,
  alt: boolean,
  reachMeters = SNAP_METERS,
): SnapResult {
  if (alt) return { point, along: null, snapped: false, error: null };
  if (SEPARATE.has(tool)) {
    const same = snapEnd(point, featuresOfKind(edits, toolKind(tool)), null, reachMeters);
    if (same.point) return { point: same.point, along: same.along, snapped: true, error: null };
    return { point, along: null, snapped: false, error: null };
  }
  return attachToSurface(point, [...roads, ...surfaceFeatures(edits)], reachMeters);
}

export function commitDrawnPath(
  edits: readonly RoadEdit[],
  input: {
    tool: DrawTool;
    points: readonly LngLat[];
    roads: readonly RoadFeature[];
    alt?: boolean;
    reachMeters?: number;
    name?: string;
  },
): { edits: RoadEdit[]; error: string | null; wayId: number | null } {
  const reach = input.reachMeters ?? SNAP_METERS;
  if (POINT.has(input.tool)) {
    const only = input.points[input.points.length - 1];
    if (!only) return { edits: [...edits], error: "Click a road.", wayId: null };
    const placed = snapDrawPoint(only, input.roads, edits, input.tool, false, reach);
    if (!placed.snapped) return { edits: [...edits], error: placed.error, wayId: null };
    return finish(edits, input.tool, [placed.point, placed.point], [placed], input.name);
  }
  if (input.points.length < 2) return { edits: [...edits], error: "Draw at least two points.", wayId: null };
  const ends = [input.points[0], input.points[input.points.length - 1]];
  const snappedEnds = ends.map((point) =>
    snapDrawPoint(point, input.roads, edits, input.tool, input.alt === true, reach),
  );
  const missed = snappedEnds.find((end) => !end.snapped);
  if (missed && !SEPARATE.has(input.tool) && input.alt !== true) {
    return {
      edits: [...edits],
      error: missed.error ?? "Click a road on the map. The link has to meet an existing road.",
      wayId: null,
    };
  }
  const line = input.points.map((point, index) => {
    if (index === 0) return snappedEnds[0].point;
    if (index === input.points.length - 1) return snappedEnds[1].point;
    return point;
  });
  return finish(edits, input.tool, line, snappedEnds, input.name);
}

export function reshapeDrawn(
  edits: readonly RoadEdit[],
  wayId: number,
  points: readonly LngLat[],
): RoadEdit[] {
  return edits.map((edit) => {
    if (edit.op !== "add" || edit.wayId !== wayId || points.length < 2) return edit;
    const next = points.map(([longitude, latitude]) => ({ longitude, latitude }));
    return { ...edit, points: next, start: next[0], end: next[next.length - 1] };
  });
}

export function patchDrawn(
  edits: readonly RoadEdit[],
  wayId: number,
  patch: Partial<Pick<Extract<RoadEdit, { op: "add" }>, "name" | "kind" | "lanes" | "maxspeedKmh" | "oneway" | "stops" | "modes">>,
): RoadEdit[] {
  return edits.map((edit) => (edit.op === "add" && edit.wayId === wayId ? { ...edit, ...patch } : edit));
}

export function removeEdits(edits: readonly RoadEdit[], wayIds: readonly number[]): RoadEdit[] {
  const drop = new Set(wayIds);
  return edits.filter((edit) => !drop.has(edit.wayId));
}

export function undoEdits(past: RoadEdit[][], present: readonly RoadEdit[], future: RoadEdit[][]) {
  if (past.length === 0) return null;
  const previous = past[past.length - 1];
  return { past: past.slice(0, -1), present: previous, future: [[...present], ...future] };
}

export function redoEdits(past: RoadEdit[][], present: readonly RoadEdit[], future: RoadEdit[][]) {
  if (future.length === 0) return null;
  const [next, ...rest] = future;
  return { past: [...past, [...present]], present: next, future: rest };
}

export function rememberEdits(past: RoadEdit[][], present: readonly RoadEdit[], next: readonly RoadEdit[]) {
  if (sameEdits(present, next)) return null;
  return { past: [...past, [...present]].slice(-40), present: [...next], future: [] as RoadEdit[][] };
}

function finish(
  edits: readonly RoadEdit[],
  tool: DrawTool,
  line: LngLat[],
  snappedEnds: SnapResult[],
  name?: string,
): { edits: RoadEdit[]; error: string | null; wayId: number | null } {
  if (edits.length >= MAX_EDITS) return { edits: [...edits], error: MAX_EDITS_ERROR, wayId: null };
  const placed = POINT.has(tool);
  if (!placed && haversine(line[0], line[line.length - 1]) < 1) {
    return { edits: [...edits], error: "Choose two different ends.", wayId: null };
  }
  const defaults = toolDefaults(tool);
  const points = line.map(([longitude, latitude], index) => {
    const end = index === 0 ? snappedEnds[0] : index === line.length - 1 ? snappedEnds[snappedEnds.length - 1] : null;
    return {
      longitude,
      latitude,
      ...(end?.along ? { along: { longitude: end.along[0], latitude: end.along[1] } } : {}),
    };
  });
  const used = edits.filter((edit) => edit.op === "add").map((edit) => edit.wayId);
  const wayId = used.length === 0 ? LINK_ID_BASE + 1 : Math.max(...used) + 1;
  const trimmed = name?.trim();
  const shaped: RoadEdit = {
    wayId,
    op: "add",
    kind: toolKind(tool),
    modes: toolModes(tool),
    ...(trimmed ? { name: trimmed } : {}),
    start: points[0],
    end: points[points.length - 1],
    points,
    lanes: defaults.lanes,
    maxspeedKmh: defaults.maxspeedKmh,
    oneway: tool === "oneway",
    ...(defaults.stops ? { stops: defaults.stops } : {}),
  };
  return { edits: [...edits, shaped], error: null, wayId };
}

function haversine(start: LngLat, end: LngLat): number {
  const radius = 6_371_000;
  const lat1 = (start[1] * Math.PI) / 180;
  const lat2 = (end[1] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((end[0] - start[0]) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Put a surface-road end on the road under the pointer. A far click is not a connection. */
function attachToSurface(point: LngLat, roads: readonly RoadFeature[], reachMeters: number): SnapResult {
  let best: { distance: number; onRoad: LngLat; road: RoadFeature } | null = null;
  for (const road of roads) {
    for (let index = 1; index < road.coordinates.length; index += 1) {
      const start = road.coordinates[index - 1];
      const end = road.coordinates[index];
      if (!start || !end) continue;
      const onRoad = closestOnSegment(point, start, end);
      const distance = haversine(point, onRoad);
      if (!best || distance < best.distance) best = { distance, onRoad, road };
    }
  }
  if (!best || best.distance > reachMeters) {
    return {
      point,
      along: null,
      snapped: false,
      error: "Click a road on the map. The link has to meet an existing road.",
    };
  }
  let vertex = best.road.coordinates[0]!;
  let vertexDistance = haversine(best.onRoad, vertex);
  for (const candidate of best.road.coordinates) {
    const distance = haversine(best.onRoad, candidate);
    if (distance < vertexDistance) {
      vertex = candidate;
      vertexDistance = distance;
    }
  }
  if (vertexDistance <= SNAP_METERS) {
    const snapped = snapEnd(best.onRoad, [best.road], null, SNAP_METERS);
    if (snapped.point) return { point: snapped.point, along: snapped.along, snapped: true, error: null };
  }
  return { point: best.onRoad, along: vertex, snapped: true, error: null };
}

function closestOnSegment(point: LngLat, start: LngLat, end: LngLat): LngLat {
  const lonScale = 111_320 * Math.cos((start[1] * Math.PI) / 180);
  const latScale = 111_320;
  const px = (point[0] - start[0]) * lonScale;
  const py = (point[1] - start[1]) * latScale;
  const bx = (end[0] - start[0]) * lonScale;
  const by = (end[1] - start[1]) * latScale;
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared));
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
}

function surfaceFeatures(edits: readonly RoadEdit[]): RoadFeature[] {
  return edits.flatMap((edit) => {
    if (edit.op !== "add" || edit.kind === "subway" || edit.kind === "railway" || edit.kind === "bridge") return [];
    return [asFeature(edit)];
  });
}

function featuresOfKind(edits: readonly RoadEdit[], kind: LinkKind): RoadFeature[] {
  return edits.flatMap((edit) => (edit.op === "add" && edit.kind === kind ? [asFeature(edit)] : []));
}

function asFeature(edit: Extract<RoadEdit, { op: "add" }>): RoadFeature {
  const coordinates = (edit.points ?? [edit.start, edit.end]).map(
    (point) => [point.longitude, point.latitude] as LngLat,
  );
  return {
    id: edit.wayId,
    highway: edit.kind,
    highwayClass: "primary",
    layerGroup: "arterial",
    maxspeedKmh: edit.maxspeedKmh ?? null,
    lanes: edit.lanes ?? null,
    oneway: edit.oneway ? "yes" : "unknown",
    structure: "none",
    lengthMeters: 1,
    bbox: { west: 0, south: 0, east: 0, north: 0 },
    coordinates,
  };
}

function sameEdits(left: readonly RoadEdit[], right: readonly RoadEdit[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
