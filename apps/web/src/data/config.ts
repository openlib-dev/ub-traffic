const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_OVERPASS_FALLBACK_URL = "https://overpass.kumi.systems/api/interpreter";
const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";

export function overpassUrls(): string[] {
  const primary = import.meta.env.VITE_OVERPASS_URL?.trim() || DEFAULT_OVERPASS_URL;
  const fallback = import.meta.env.VITE_OVERPASS_FALLBACK_URL?.trim() || DEFAULT_OVERPASS_FALLBACK_URL;
  return primary === fallback ? [primary] : [primary, fallback];
}

export function nominatimBaseUrl(): string {
  return (import.meta.env.VITE_NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM_URL).replace(/\/$/, "");
}

export function satelliteTileUrl(): string | undefined {
  const url = import.meta.env.VITE_SATELLITE_TILE_URL?.trim();
  return url || undefined;
}
