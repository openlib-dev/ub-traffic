/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OVERPASS_URL?: string;
  readonly VITE_OVERPASS_FALLBACK_URL?: string;
  readonly VITE_NOMINATIM_URL?: string;
  readonly VITE_SATELLITE_TILE_URL?: string;
  readonly VITE_SIMULATION_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
