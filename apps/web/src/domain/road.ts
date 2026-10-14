export type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type LngLat = [number, number];

export type HighwayClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "unclassified"
  | "residential"
  | "living_street"
  | "service"
  | "other";

export type RoadLayerGroup = "arterial" | "local" | "service";

export type Oneway = "yes" | "no" | "reverse" | "unknown";

export type RoadStructure = "bridge" | "tunnel" | "none";

export type LayerToggles = {
  arterials: boolean;
  local: boolean;
  service: boolean;
};

export type RoadLoadDetail = {
  zoom: number;
  layers: LayerToggles;
};

export type RoadFeature = {
  id: number;
  highway: string;
  highwayClass: HighwayClass;
  layerGroup: RoadLayerGroup;
  name?: string;
  nameEn?: string;
  maxspeedKmh: number | null;
  lanes: number | null;
  oneway: Oneway;
  structure: RoadStructure;
  surface?: string;
  lengthMeters: number;
  bbox: BBox;
  coordinates: LngLat[];
};

export type RoadNetworkSource = {
  loadRoads: (
    bbox: BBox,
    detail: RoadLoadDetail,
    signal?: AbortSignal,
  ) => Promise<RoadFeature[]>;
};

const ARTERIAL_HIGHWAYS = [
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
] as const;

const LOCAL_HIGHWAYS = ["unclassified", "residential", "living_street"] as const;

const SERVICE_HIGHWAYS = ["service"] as const;

const CLASS_BY_HIGHWAY: Record<string, HighwayClass> = {
  motorway: "motorway",
  motorway_link: "motorway",
  trunk: "trunk",
  trunk_link: "trunk",
  primary: "primary",
  primary_link: "primary",
  secondary: "secondary",
  secondary_link: "secondary",
  tertiary: "tertiary",
  tertiary_link: "tertiary",
  unclassified: "unclassified",
  residential: "residential",
  living_street: "living_street",
  service: "service",
};

export function classifyHighway(highway: string): HighwayClass {
  return CLASS_BY_HIGHWAY[highway] ?? "other";
}

export function layerGroupFor(highwayClass: HighwayClass): RoadLayerGroup {
  if (
    highwayClass === "motorway" ||
    highwayClass === "trunk" ||
    highwayClass === "primary" ||
    highwayClass === "secondary" ||
    highwayClass === "tertiary"
  ) {
    return "arterial";
  }
  if (highwayClass === "service") return "service";
  return "local";
}

export function highwayFiltersForLoad(detail: RoadLoadDetail): string[] {
  const highways: string[] = [];
  if (detail.layers.arterials) highways.push(...ARTERIAL_HIGHWAYS);
  if (detail.layers.local && detail.zoom >= 13) highways.push(...LOCAL_HIGHWAYS);
  if (detail.layers.service && detail.zoom >= 16) highways.push(...SERVICE_HIGHWAYS);
  return highways;
}

export function isRoadVisible(road: RoadFeature, zoom: number, layers: LayerToggles): boolean {
  if (road.layerGroup === "arterial") return layers.arterials;
  if (road.layerGroup === "local") return layers.local && zoom >= 13;
  if (road.layerGroup === "service") return layers.service && zoom >= 16;
  return false;
}

export function parseMaxspeed(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:\s*(mph|km\/h|kmh|kph))?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (match[2]?.toLowerCase() === "mph") return Math.round(amount * 1.60934);
  return Math.round(amount);
}

export function parseLanes(value: string | undefined): number | null {
  if (!value) return null;
  const first = value.split(/[;|]/)[0]?.trim();
  if (!first || !/^\d+$/.test(first)) return null;
  const lanes = Number(first);
  if (lanes < 1 || lanes > 16) return null;
  return lanes;
}

export function parseOneway(value: string | undefined): Oneway {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") return "yes";
  if (normalized === "-1" || normalized === "reverse") return "reverse";
  if (normalized === "no" || normalized === "false" || normalized === "0") return "no";
  return "unknown";
}

function cleanTag(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function chooseRoadNames(tags: {
  name?: string;
  "name:mn"?: string;
  "name:en"?: string;
}): { name?: string; nameEn?: string } {
  return {
    name: cleanTag(tags.name) ?? cleanTag(tags["name:mn"]),
    nameEn: cleanTag(tags["name:en"]),
  };
}

export function displayName(road: { name?: string; nameEn?: string }): string {
  return road.name || road.nameEn || "Unnamed road";
}

export function parseStructure(tags: { bridge?: string; tunnel?: string }): RoadStructure {
  if (tags.bridge === "yes" || tags.bridge === "viaduct" || tags.bridge === "cantilever") {
    return "bridge";
  }
  if (tags.tunnel === "yes") return "tunnel";
  return "none";
}

export function lengthMeters(coordinates: LngLat[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += haversineMeters(coordinates[index - 1]!, coordinates[index]!);
  }
  return total;
}

export function bboxOf(coordinates: LngLat[]): BBox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

export function expandBBox(bbox: BBox, fraction: number): BBox {
  const width = (bbox.east - bbox.west) * fraction;
  const height = (bbox.north - bbox.south) * fraction;
  return {
    west: bbox.west - width,
    east: bbox.east + width,
    south: bbox.south - height,
    north: bbox.north + height,
  };
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    outer.west <= inner.west &&
    outer.east >= inner.east &&
    outer.south <= inner.south &&
    outer.north >= inner.north
  );
}

export function isLoadableBBox(bbox: BBox): boolean {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  return width > 0 && height > 0 && width <= 0.8 && height <= 0.6;
}

export function pruneRoads(roads: RoadFeature[], view: BBox, margin = 0.5): RoadFeature[] {
  const keep = expandBBox(view, margin);
  return roads.filter((road) => bboxIntersects(road.bbox, keep));
}

export function mergeRoads(existing: RoadFeature[], incoming: RoadFeature[]): RoadFeature[] {
  const byId = new Map(existing.map((road) => [road.id, road]));
  for (const road of incoming) byId.set(road.id, road);
  return [...byId.values()];
}

export function isSubset(next: readonly string[], previous: readonly string[]): boolean {
  const known = new Set(previous);
  return next.every((value) => known.has(value));
}

const LANE_JOIN_METERS = 20;

function laneLabel(road: RoadFeature): string | null {
  const name = road.name?.trim() || road.nameEn?.trim();
  return name ? name : null;
}

function endsMeet(a: RoadFeature, b: RoadFeature): boolean {
  const aEnds = [a.coordinates[0]!, a.coordinates[a.coordinates.length - 1]!];
  const bEnds = [b.coordinates[0]!, b.coordinates[b.coordinates.length - 1]!];
  return aEnds.some((left) => bEnds.some((right) => haversineMeters(left, right) <= LANE_JOIN_METERS));
}

function walkLane(candidates: readonly RoadFeature[], start: RoadFeature): number[] {
  const seen = new Set<number>([start.id]);
  const queue = [start];
  const ids = [start.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of candidates) {
      if (seen.has(next.id) || !endsMeet(current, next)) continue;
      seen.add(next.id);
      queue.push(next);
      ids.push(next.id);
    }
  }
  return ids;
}

export function oppositeOneway(value: Oneway): Oneway | null {
  if (value === "yes") return "reverse";
  if (value === "reverse") return "yes";
  return null;
}

/** Connected pieces with the same name, class, and direction. Unnamed ways stay alone. */
export function laneChain(roads: readonly RoadFeature[], wayId: number, oneway?: Oneway): number[] {
  const start = roads.find((road) => road.id === wayId);
  if (!start) return [];
  const direction = oneway ?? start.oneway;
  const name = laneLabel(start);
  if (!name) return direction === start.oneway ? [start.id] : [];
  const same = roads.filter(
    (road) => laneLabel(road) === name && road.highwayClass === start.highwayClass && road.oneway === direction,
  );
  if (direction === start.oneway) return walkLane(same, start);
  const ids = new Set<number>();
  for (const seed of same.filter((road) => endsMeet(road, start))) {
    for (const id of walkLane(same, seed)) ids.add(id);
  }
  return [...ids];
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type OverpassWay = {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export function roadFromOverpassWay(element: OverpassWay): RoadFeature | null {
  if (element.type !== "way" || typeof element.id !== "number") return null;
  const highway = element.tags?.highway;
  const geometry = element.geometry;
  if (!highway || !geometry || geometry.length < 2) return null;

  const coordinates = geometry.map((point) => [point.lon, point.lat] as LngLat);
  const names = chooseRoadNames(element.tags ?? {});
  const highwayClass = classifyHighway(highway);
  const tags = element.tags ?? {};

  return {
    id: element.id,
    highway,
    highwayClass,
    layerGroup: layerGroupFor(highwayClass),
    name: names.name,
    nameEn: names.nameEn,
    maxspeedKmh: parseMaxspeed(tags.maxspeed),
    lanes: parseLanes(tags.lanes),
    oneway: parseOneway(tags.oneway),
    structure: parseStructure(tags),
    surface: cleanTag(tags.surface),
    lengthMeters: lengthMeters(coordinates),
    bbox: bboxOf(coordinates),
    coordinates,
  };
}

export function formatHighway(highway: string): string {
  return highway
    .split("_")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function formatOneway(oneway: Oneway): string {
  if (oneway === "yes") return "One-way";
  if (oneway === "reverse") return "One-way, reverse";
  if (oneway === "no") return "Two-way";
  return "Unknown";
}

export function formatStructure(structure: RoadStructure): string {
  if (structure === "bridge") return "Bridge";
  if (structure === "tunnel") return "Tunnel";
  return "At grade";
}

export function formatSpeed(maxspeedKmh: number | null): string {
  return maxspeedKmh === null ? "Unknown" : `${maxspeedKmh} km/h`;
}

export function formatLanes(lanes: number | null): string {
  return lanes === null ? "Unknown" : String(lanes);
}

export function formatSurface(surface: string | undefined): string {
  if (!surface) return "Unknown";
  return surface
    .split("_")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "Unknown";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const digits = meters < 10_000 ? 2 : 1;
  return `${(meters / 1000).toFixed(digits)} km`;
}
