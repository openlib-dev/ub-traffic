import type { BBox } from "@/domain/road";

export type PlaceHit = {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  bbox?: BBox;
};

export const ULAANBAATAR = {
  label: "Ulaanbaatar, Mongolia",
  longitude: 106.917,
  latitude: 47.919,
  zoom: 13,
} as const;

export function cameraForPlace(place: PlaceHit): { zoom: number; fitBounds: boolean } {
  const bbox = place.bbox;
  if (!bbox) return { zoom: 13, fitBounds: false };
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  if (width >= 1.2 || height >= 1.2) return { zoom: 11, fitBounds: false };
  if (width > 0.01 && height > 0.01) return { zoom: 13, fitBounds: true };
  return { zoom: 15, fitBounds: false };
}
