import type { StyleSpecification } from "maplibre-gl";
import { satelliteTileUrl } from "@/data/config";
import type { BasemapId } from "@/state/use-app-store";

const STYLE_URL: Record<Exclude<BasemapId, "satellite">, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

const styleCache = new Map<string, Promise<StyleSpecification>>();

export function stripBasemapRoads(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter((layer) => {
      if (!("source-layer" in layer) || layer["source-layer"] !== "transportation") return true;
      return layer.id.includes("railway");
    }),
  };
}

export function roadInsertBeforeId(style: StyleSpecification): string | undefined {
  const roadNames = style.layers.find(
    (layer) =>
      layer.type === "symbol" &&
      "source-layer" in layer &&
      layer["source-layer"] === "transportation_name",
  );
  if (roadNames) return roadNames.id;
  const place = style.layers.find(
    (layer) => layer.type === "symbol" && "source-layer" in layer && layer["source-layer"] === "place",
  );
  return place?.id;
}

export function loadBasemap(id: BasemapId): Promise<StyleSpecification> {
  if (id === "satellite") {
    const tiles = satelliteTileUrl();
    if (!tiles) return Promise.reject(new Error("Satellite imagery is not configured."));
    return Promise.resolve(satelliteStyle(tiles));
  }

  const url = STYLE_URL[id];
  const cached = styleCache.get(url);
  if (cached) return cached;

  const pending = fetch(url, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`Basemap failed (${response.status})`);
      return response.json() as Promise<StyleSpecification>;
    })
    .then((style) => stripBasemapRoads(style));

  styleCache.set(url, pending);
  pending.catch(() => {
    styleCache.delete(url);
  });
  return pending;
}

function satelliteStyle(tileUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: "Satellite imagery",
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  };
}

export const satelliteConfigured = Boolean(satelliteTileUrl());
