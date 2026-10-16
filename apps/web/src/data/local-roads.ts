import {
  bboxIntersects,
  highwayFiltersForLoad,
  mergeRoads,
  roadFromOverpassWay,
  type BBox,
  type RoadFeature,
  type RoadLoadDetail,
  type RoadNetworkSource,
} from "@/domain/road";

export type LocalExtract = {
  coverage: BBox;
  roads: RoadFeature[];
};

const EXTRACT_URL = "/data/ulaanbaatar-roads.json";

let extractRequest: Promise<LocalExtract | null> | null = null;
let cachedExtract: LocalExtract | null = null;

/** Roads from the city file, once that file has loaded. */
export function cachedLocalRoads(): readonly RoadFeature[] | null {
  return cachedExtract?.roads ?? null;
}

export function localRoadsReady(): boolean {
  return cachedExtract !== null;
}

export function loadLocalRoads(): Promise<readonly RoadFeature[] | null> {
  return loadBundledExtract().then((extract) => extract?.roads ?? null);
}

/** City-file roads plus anything loaded from outside the extract, so a lane can cross the current view. */
export function roadsForLane(
  loaded: readonly RoadFeature[],
  catalog: readonly RoadFeature[] | null = cachedLocalRoads(),
): RoadFeature[] {
  if (!catalog) return [...loaded];
  return mergeRoads([...catalog], [...loaded]);
}

export function createLocalRoadSource(
  loadExtract: () => Promise<LocalExtract | null> = loadBundledExtract,
): RoadNetworkSource & { coverage: () => Promise<BBox | null> } {
  return {
    coverage: async () => (await loadExtract())?.coverage ?? null,
    async loadRoads(bbox, detail) {
      const extract = await loadExtract();
      if (!extract || !bboxIntersects(extract.coverage, bbox)) return [];
      return roadsInView(extract.roads, bbox, detail);
    },
  };
}

export function roadsInView(
  roads: readonly RoadFeature[],
  bbox: BBox,
  detail: RoadLoadDetail,
): RoadFeature[] {
  const allowed = new Set(highwayFiltersForLoad(detail));
  return roads.filter((road) => allowed.has(road.highway) && bboxIntersects(road.bbox, bbox));
}

export function viewUsesLocalExtract(coverage: BBox | null, bbox: BBox): boolean {
  return coverage !== null && bboxIntersects(coverage, bbox);
}

export function parseLocalExtract(payload: unknown): LocalExtract | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as {
    coverage?: Partial<BBox>;
    features?: unknown[];
  };
  const coverage = record.coverage;
  if (!coverage || !isBBox(coverage) || !Array.isArray(record.features)) return null;

  const roads: RoadFeature[] = [];
  for (const feature of record.features) {
    const road = roadFromGeoJsonFeature(feature);
    if (road) roads.push(road);
  }
  return { coverage, roads };
}

function roadFromGeoJsonFeature(feature: unknown): RoadFeature | null {
  if (!feature || typeof feature !== "object") return null;
  const record = feature as {
    id?: number;
    properties?: Record<string, string>;
    geometry?: { type?: string; coordinates?: number[][] };
  };
  const coordinates = record.geometry?.coordinates;
  if (record.geometry?.type !== "LineString" || !Array.isArray(coordinates)) return null;
  return roadFromOverpassWay({
    type: "way",
    id: record.id,
    tags: record.properties,
    geometry: coordinates.map((point) => ({ lon: point[0] ?? 0, lat: point[1] ?? 0 })),
  });
}

function isBBox(value: Partial<BBox>): value is BBox {
  return [value.west, value.south, value.east, value.north].every(
    (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
  );
}

function loadBundledExtract(): Promise<LocalExtract | null> {
  extractRequest ??= fetch(EXTRACT_URL)
    .then(async (response) => {
      if (!response.ok) return null;
      const extract = parseLocalExtract(await response.json());
      if (extract) cachedExtract = extract;
      return extract;
    })
    .catch(() => null);
  return extractRequest;
}
