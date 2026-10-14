# Ulaanbaatar traffic simulation

Interactive map of the Ulaanbaatar OpenStreetMap road network, plus an estimated SUMO morning scenario. Demand is synthetic. Congestion colors and vehicle positions appear only after a run publishes segment speeds. Do not invent metrics, percents, or charts.

## Layout

| Path | Package | Role |
| --- | --- | --- |
| `apps/web` | `@ub/web` | Vite, React, TypeScript map and UI |
| `services/sim` | | FastAPI SUMO worker. Docker service `sim`, port 8081 |
| `tools/osm` | `@ub/osm` | Extract scripts (roads, district OSM, commute attractors) |
| `data` | | Local cache and simulation output. Not source. Gitignored |

npm workspaces hoist dependencies to the root `node_modules`. `@ub/web` and `@ub/osm` there are symlinks to the packages. `apps/web/node_modules` is only the Vite cache.

The web UI defaults to Mongolian, with an EN switch. Chrome is black. The map is the light OpenFreeMap style unless the user picks dark.

## Commands

From the repository root:

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm test             # web unit tests, then OSM script tests
npm run build
npm run roads:fetch  # Mongolia PBF → apps/web/public/data/ulaanbaatar-roads.json
npm run district:export
npm run attractors:export
docker compose up --build
```

Typecheck the web app from `apps/web` (`npx tsc -b`). The root `tsc` fails. Python tests run from `services/sim` with `python3 -m unittest tests.test_<name>`. The host Python does not have FastAPI; worker tests that import the server run inside the container.

`apps/web/.env` sets `VITE_SIMULATION_URL=http://127.0.0.1:8081`. Copy `.env.example` if it is missing.

The worker image copies `services/sim/sumo_worker`. Python changes are invisible until `docker compose build sim && docker compose up -d sim`. SUMO weight files must stay one `<edge>` per line.

## Map and edits

The city box is west 106.75, south 47.82, east 107.20, north 48.05. Inside that box the map reads the local road file. Outside it, the app calls Overpass. Place search uses Nominatim.

The base map is the original network and is not editable. A template is a named copy of that network. Drawing, undo, erase, and road actions (close, park, stall, construction, lanes, speed, access) write only while exactly one `template:` item is selected. Saved simulation results used as templates are preview-only. Comparing two templates is read-only.

A click selects a continuous lane: loaded ways that share a name (`name`, otherwise `nameEn`), road class, and `oneway`, and whose ends are within 20 m. Unnamed ways stay one piece. Shift-click adds the opposite direction. Those edits apply to every selected piece. A scenario can change at most 400 ways.

New drawn links use way ids from `8000000000001` upward. A surface road must land within 40 m of an existing road. Subway, railway, and bridge do not snap to surface roads. Alt keeps the raw click.

Do not rewrite the baseline OSM extract. Scenario edits are a diff applied to a copy.

## Simulation

The preset is morning peak, 07:30–07:45, 2000 vehicles, seed 42. Vehicles are 1–5000. Playback speeds are 1, 2, 5, and 10. Commute attractors (offices and universities) default on. The Zaisan signal slows automatically before 09:00 and from 18:00.

One SUMO run at a time. `GET /runs/active` lets a refreshed page reattach to the run that is still going and keep its progress. Cancel is the existing cancel endpoint. A comparison is two runs; a refresh continues only the half that is actually running.

Congestion from the speed ratio: above 0.8 free, above 0.5 moderate, above 0.25 heavy, otherwise severe. Saved results and charts use recorded severe seconds only.

Templates live in `data/sim/runs/templates`. Saved results live in `data/sim/runs/saved`. Do not delete the user's saved results or drawn templates unless they ask.

## What not to build unless asked

Go, PostGIS, Redis, and Recharts are not in this repo. Do not mock a simulation result. Do not commit unless asked.
