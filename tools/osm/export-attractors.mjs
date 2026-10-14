import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const parsePbf = require("tiny-osmpbf");

export const CITY = { west: 106.75, south: 47.82, east: 107.2, north: 48.05 };

export function placeKind(tags) {
  if (!tags) return null;
  if (tags.amenity === "university" || tags.amenity === "college" || tags.building === "university") {
    return "university";
  }
  if (tags.office || tags.building === "office") return "office";
  return null;
}

export function placeName(tags, kind) {
  const named = tags?.name || tags?.["name:en"] || tags?.["name:mn"];
  if (named) return String(named).slice(0, 80);
  return kind === "university" ? "University" : "Office";
}

export function insideCity(longitude, latitude, coverage = CITY) {
  return (
    longitude >= coverage.west &&
    longitude <= coverage.east &&
    latitude >= coverage.south &&
    latitude <= coverage.north
  );
}

/** One place per kind and rounded coordinate, so a campus mapped twice is kept once. */
export function collectPlaces(candidates) {
  const places = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || (candidate.kind !== "university" && candidate.kind !== "office")) continue;
    if (!insideCity(candidate.longitude, candidate.latitude)) continue;
    const key = `${candidate.kind}:${candidate.longitude.toFixed(4)}:${candidate.latitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      kind: candidate.kind,
      name: candidate.name,
      longitude: round(candidate.longitude),
      latitude: round(candidate.latitude),
    });
  }
  places.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.longitude - b.longitude);
  return places;
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

function centroid(refs, nodes) {
  let count = 0;
  let longitude = 0;
  let latitude = 0;
  for (const ref of refs) {
    const point = nodes.get(ref);
    if (!point) continue;
    longitude += point[0];
    latitude += point[1];
    count += 1;
  }
  if (count === 0) return null;
  return [longitude / count, latitude / count];
}

function readPlaces(buffer) {
  const nodes = new Map();
  const candidates = [];
  parsePbf(buffer, (item) => {
    if (item.type === "node") {
      if (!insideCity(item.lon, item.lat)) return;
      nodes.set(item.id, [item.lon, item.lat]);
      const kind = placeKind(item.tags);
      if (!kind) return;
      candidates.push({
        kind,
        name: placeName(item.tags, kind),
        longitude: item.lon,
        latitude: item.lat,
      });
      return;
    }
    if (item.type !== "way" || !item.nodes) return;
    const kind = placeKind(item.tags);
    if (!kind) return;
    const center = centroid(item.nodes, nodes);
    if (!center) return;
    candidates.push({
      kind,
      name: placeName(item.tags, kind),
      longitude: center[0],
      latitude: center[1],
    });
  });
  return collectPlaces(candidates);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const pbfPath = path.join(root, "data/cache/mongolia-latest.osm.pbf");
  const outPath = path.join(root, "data/sim/attractors.json");
  if (!existsSync(pbfPath) || statSync(pbfPath).size < 1_000_000) {
    throw new Error("Mongolia extract is missing. Run npm run roads:fetch.");
  }
  console.log("Reading offices and universities…");
  const places = readPlaces(readFileSync(pbfPath));
  const universities = places.filter((place) => place.kind === "university").length;
  const offices = places.length - universities;
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        attribution: "© OpenStreetMap contributors",
        coverage: CITY,
        places,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${universities} universities and ${offices} offices to ${outPath}`);
}
