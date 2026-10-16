# Ulaanbaatar Traffic

Interactive map for the OpenStreetMap road network in Ulaanbaatar, with one estimated SUMO scenario for the whole city. Road geometry and tags come from OpenStreetMap. Congestion colors and vehicle positions appear only after that scenario finishes. Demand is synthetic, not calibrated counts.

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `apps/web` | `@ub/web` | Map and simulation UI |
| `services/sim` | | SUMO worker, started with Docker Compose |
| `tools/osm` | `@ub/osm` | Scripts that build the city extract from OpenStreetMap |
| `data` | | Local cache and simulation output. Not source. |

`npm run dev`, `npm test`, and `npm run build` from the repository root run the web app. The OSM commands run `@ub/osm`.

## Requirements

- Node.js 20 or newer
- A browser
- Docker, for the SUMO worker

Public Overpass is only used when the map moves outside the Ulaanbaatar extract. Nominatim is used for place search. Both are rate-limited.

## Setup

From the repository root:

```bash
npm install
npm run roads:fetch
npm run dev
```

`roads:fetch` downloads the Geofabrik Mongolia extract once (about 60 MB, kept in `data/cache` and not committed) and writes Ulaanbaatar roads to `apps/web/public/data/ulaanbaatar-roads.json`. After that, panning and zooming inside the city read that file. Run `roads:fetch` again when you want a newer OpenStreetMap snapshot.

Open the URL Vite prints (usually `http://localhost:5173`). The map opens on Sukhbaatar Square. Click a road to read its OpenStreetMap attributes.

```bash
npm test
npm run build
```

## Simulation

The morning scenario covers Ulaanbaatar (west 106.750, south 47.820, east 107.200, north 48.050). Docker runs SUMO. The web app does not.

```bash
npm run district:export
docker compose up --build
```

Copy `apps/web/.env.example` to `apps/web/.env` and set `VITE_SIMULATION_URL=http://127.0.0.1:8081`, then start the web app again. The preset is **Morning peak, estimated**: 07:30–07:45, 2000 passenger cars, seed 42. The vehicle field accepts 1 to 5000. Demand is synthetic, not calibrated counts. Playback colors a road only when that second has a segment speed from the run. Roads with no vehicles keep their OpenStreetMap class color. Clearing playback removes the congestion colors.

The first start builds the SUMO network from the city file, then steps the scenario. Cancel stops the SUMO process. With the worker stopped, or without `VITE_SIMULATION_URL`, the status bar stays on "No active simulation".

## Environment

Copy `apps/web/.env.example` to `apps/web/.env` to override endpoints. All variables are optional.

| Variable | Purpose |
| --- | --- |
| `VITE_OVERPASS_URL` | Primary Overpass interpreter |
| `VITE_OVERPASS_FALLBACK_URL` | Second interpreter if the first fails |
| `VITE_NOMINATIM_URL` | Place search |
| `VITE_SATELLITE_TILE_URL` | Raster tiles (`{z}`, `{x}`, `{y}`). Satellite stays disabled until this is set |
| `VITE_SIMULATION_URL` | SUMO worker, for example `http://127.0.0.1:8081` |

## What the colors mean

Without a finished run, road color is the OpenStreetMap class (motorway, primary, residential, and so on). During playback, a road with a segment speed uses green, yellow, orange, or red. A road with no vehicles in that second keeps its class color. Clearing playback restores class colors.

The status bar stays on "No active simulation" until a run is in progress or a recorded frame is showing.

## Editing and comparison

The base map is the OpenStreetMap extract and stays locked. A template is a named copy of that network. Drawing and road actions write only while one template is open, and those edits are a diff: the extract file is not rewritten. Comparing two templates is read-only.

**Compare** runs the same clock, vehicle count, and seed on the unchanged network, then on the scenario. A refresh continues the half that is still running, and starts the second half when the first has already finished. While a run is going, the map shows that progress and a cancel button.

The dashboard ranks roads by recorded severe seconds from a finished run. Demand stays synthetic. Go, PostGIS, Redis, and Recharts are not part of this repository.
