import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const parsePbf = require("tiny-osmpbf");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, "data/cache");
const pbfPath = path.join(cacheDir, "mongolia-latest.osm.pbf");
const outPath = path.join(root, "apps/web/public/data/ulaanbaatar-roads.json");
const pbfUrl = "https://download.geofabrik.de/asia/mongolia-latest.osm.pbf";

const coverage = { west: 106.75, south: 47.82, east: 107.2, north: 48.05 };
const nodeMargin = 0.05;

const highways = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "unclassified",
  "residential",
  "living_street",
  "service",
]);

const tagKeys = ["highway", "name", "name:en", "name:mn", "maxspeed", "lanes", "oneway", "bridge", "tunnel", "surface"];

mkdirSync(cacheDir, { recursive: true });
mkdirSync(path.dirname(outPath), { recursive: true });

if (!process.argv.includes("--download") && existsSync(pbfPath) && statSync(pbfPath).size > 1_000_000) {
  console.log("Using existing", pbfPath);
} else {
  console.log("Downloading Mongolia extract…");
  const response = await fetch(pbfUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(pbfPath));
  console.log("Saved", pbfPath);
}

console.log("Reading Ulaanbaatar roads…");
const { ways, nodes } = readExtract(readFileSync(pbfPath));
console.log(`${ways.length} highway ways, ${nodes.size} nodes in range`);
const features = ways.flatMap((way) => toFeatures(way, nodes));
features.sort((a, b) => a.id - b.id);

const payload = {
  attribution: "© OpenStreetMap contributors",
  coverage,
  type: "FeatureCollection",
  features,
};

await pipeline(
  Readable.from([JSON.stringify(payload)]),
  createWriteStream(outPath),
);
console.log(`Wrote ${features.length} roads to ${outPath}`);

function readExtract(buffer) {
  const ways = [];
  const nodes = new Map();
  const nodeBBox = expanded(coverage, nodeMargin);
  parsePbf(buffer, (item) => {
    if (item.type === "node") {
      if (inside(item.lon, item.lat, nodeBBox)) nodes.set(item.id, [round(item.lon), round(item.lat)]);
      return;
    }
    if (item.type !== "way" || !item.nodes || !highways.has(item.tags?.highway)) return;
    ways.push({
      id: item.id,
      tags: pickTags(item.tags),
      refs: item.nodes,
    });
  });
  return { ways, nodes };
}

function toFeatures(way, nodes) {
  const runs = [];
  let current = [];
  for (const ref of way.refs) {
    const point = nodes.get(ref);
    if (!point) {
      if (current.length >= 2) runs.push(current);
      current = [];
      continue;
    }
    current.push(point);
  }
  if (current.length >= 2) runs.push(current);

  const longest = runs.sort((a, b) => b.length - a.length)[0];
  if (!longest || !lineIntersects(longest, coverage)) return [];
  return [
    {
      type: "Feature",
      id: way.id,
      properties: way.tags,
      geometry: { type: "LineString", coordinates: longest },
    },
  ];
}

function pickTags(tags) {
  const picked = {};
  for (const key of tagKeys) {
    if (tags[key]) picked[key] = tags[key];
  }
  return picked;
}

function lineIntersects(coordinates, bbox) {
  return coordinates.some(([lon, lat]) => inside(lon, lat, bbox));
}

function inside(lon, lat, bbox) {
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

function expanded(bbox, margin) {
  return {
    west: bbox.west - margin,
    south: bbox.south - margin,
    east: bbox.east + margin,
    north: bbox.north + margin,
  };
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}
