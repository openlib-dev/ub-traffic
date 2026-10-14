import { cameraForPlace, type PlaceHit } from "@/domain/city";
import type { BBox } from "@/domain/road";
import { nominatimBaseUrl } from "@/data/config";

export async function searchPlaces(query: string, locale: "mn" | "en" = "mn", signal?: AbortSignal): Promise<PlaceHit[]> {
  const url = new URL("/search", nominatimBaseUrl());
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", locale === "mn" ? "mn,en" : "en");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  return parseNominatimResults(await response.json());
}

export function parseNominatimResults(payload: unknown): PlaceHit[] {
  if (!Array.isArray(payload)) return [];
  const hits: PlaceHit[] = [];
  for (const item of payload) {
    const hit = parseNominatimItem(item);
    if (hit) hits.push(hit);
  }
  return hits;
}

function parseNominatimItem(item: unknown): PlaceHit | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const latitude = Number(record.lat);
  const longitude = Number(record.lon);
  const label = typeof record.display_name === "string" ? shortenLabel(record.display_name) : "";
  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const id = record.place_id === undefined ? `${longitude},${latitude}` : String(record.place_id);
  return {
    id,
    label,
    longitude,
    latitude,
    bbox: parseBoundingBox(record.boundingbox),
  };
}

function parseBoundingBox(value: unknown): BBox | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const south = Number(value[0]);
  const north = Number(value[1]);
  const west = Number(value[2]);
  const east = Number(value[3]);
  if (![south, north, west, east].every(Number.isFinite)) return undefined;
  if (south > north || west > east) return undefined;
  return { west, south, east, north };
}

function shortenLabel(displayName: string): string {
  return displayName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

export function flyTargetForPlace(place: PlaceHit): {
  label: string;
  longitude: number;
  latitude: number;
  zoom: number;
  bbox?: BBox;
} {
  const camera = cameraForPlace(place);
  return {
    label: place.label,
    longitude: place.longitude,
    latitude: place.latitude,
    zoom: camera.zoom,
    bbox: camera.fitBounds ? place.bbox : undefined,
  };
}
