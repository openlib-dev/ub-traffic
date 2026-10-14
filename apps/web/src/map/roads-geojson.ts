import type { FeatureCollection, LineString } from "geojson";
import { isRoadVisible, type LayerToggles, type RoadFeature } from "@/domain/road";
import type { TemplateSide } from "@/domain/template";
import type { CongestionLevel, RoadEdit } from "@/domain/simulation";

export function toRoadCollection(
  roads: readonly RoadFeature[],
  zoom: number,
  layers: LayerToggles,
  congestion?: ReadonlyMap<number, CongestionLevel> | null,
  edits?: ReadonlyMap<number, RoadEdit["op"]> | null,
  severeSeconds?: ReadonlyMap<number, number> | null,
  severeDelta?: ReadonlyMap<number, number> | null,
  templateSides?: ReadonlyMap<number, TemplateSide> | null,
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: roads
      .filter((road) => isRoadVisible(road, zoom, layers))
      .map((road) => {
        const level = congestion?.get(road.id);
        const edit = edits?.get(road.id);
        const seconds = severeSeconds?.get(road.id) ?? 0;
        const delta = severeDelta?.get(road.id);
        const templateSide = templateSides?.get(road.id);
        const scenario = edit === "close" ? "closed" : edit ? "changed" : undefined;
        return {
          type: "Feature" as const,
          id: road.id,
          properties: {
            id: road.id,
            highwayClass: road.highwayClass,
            ...(level ? { congestion: level } : {}),
            ...(scenario ? { scenario } : {}),
            ...(templateSide ? { templateSide } : {}),
            ...(seconds > 0 ? { severeSeconds: seconds } : {}),
            ...(delta ? { severeDelta: delta } : {}),
          },
          geometry: {
            type: "LineString" as const,
            coordinates: road.coordinates,
          },
        };
      }),
  };
}

export function roadIdFromFeature(feature: { properties?: Record<string, unknown> | null } | undefined): number | null {
  const raw = feature?.properties?.id;
  const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}
