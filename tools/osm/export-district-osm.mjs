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
const outPath = path.join(root, "data/sim/ulaanbaatar.osm");
const pbfUrl = "https://download.geofabrik.de/asia/mongolia-latest.osm.pbf";

/** Same Ulaanbaatar extent as the local map extract. */
const district = { west: 106.75, south: 47.82, east: 107.2, north: 48.05 };
const nodeMargin = 0.02;

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
]);

const wayTagKeys = [
  "highway",
  "name",
  "name:en",
  "name:mn",
  "ref",
  "maxspeed",
  "lanes",
  "lanes:forward",
  "lanes:backward",
  "oneway",
  "junction",
  "bridge",
  "tunnel",
  "layer",
  "access",
  "surface",
  "width",
  "sidewalk",
  "service",
  "motor_vehicle",
  "bus",
  "bicycle",
  "foot",
  "hgv",
  "psv",
  "cycleway",
  "busway",
  "turn:lanes",
  "placement",
  "incline",
  "maxheight",
  "maxweight",
];

const nodeTagKeys = ["highway", "traffic_signals", "traffic_signals:direction", "crossing", "railway", "barrier", "noexit"];

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

console.log("Clipping Ulaanbaatar…");
const { ways, nodes } = readDistrict(readFileSync(pbfPath));
const kept = ways.flatMap((way) => clipWay(way, nodes)).sort((a, b) => a.id - b.id);
const used = new Set(kept.flatMap((way) => way.refs));
const nodeIds = [...used].sort((a, b) => a - b);

const stream = createWriteStream(outPath);
stream.write(`<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="ub-simulation">
<bounds minlat="${district.south}" minlon="${district.west}" maxlat="${district.north}" maxlon="${district.east}"/>
`);
for (const id of nodeIds) {
  const node = nodes.get(id);
  const tags = renderTags(node.tags);
  if (tags) stream.write(`<node id="${id}" lat="${node.lat}" lon="${node.lon}">${tags}</node>\n`);
  else stream.write(`<node id="${id}" lat="${node.lat}" lon="${node.lon}"/>\n`);
}
for (const way of kept) {
  const refs = way.refs.map((id) => `<nd ref="${id}"/>`).join("");
  stream.write(`<way id="${way.id}">${refs}${renderTags(way.tags)}</way>\n`);
}
stream.write("</osm>\n");
await new Promise((resolve, reject) => {
  stream.end(() => resolve());
  stream.on("error", reject);
});
console.log(`Wrote ${kept.length} ways and ${nodeIds.length} nodes to ${outPath}`);

function readDistrict(buffer) {
  const ways = [];
  const nodes = new Map();
  const nodeBBox = expanded(district, nodeMargin);
  parsePbf(buffer, (item) => {
    if (item.type === "node") {
      if (!inside(item.lon, item.lat, nodeBBox)) return;
      nodes.set(item.id, {
        lon: round(item.lon),
        lat: round(item.lat),
        tags: pickTags(item.tags, nodeTagKeys),
      });
      return;
    }
    if (item.type !== "way" || !item.nodes || !highways.has(item.tags?.highway)) return;
    ways.push({
      id: item.id,
      tags: pickTags(item.tags, wayTagKeys),
      refs: item.nodes,
    });
  });
  return { ways, nodes };
}

function clipWay(way, nodes) {
  const runs = [];
  let current = [];
  for (const ref of way.refs) {
    if (!nodes.has(ref)) {
      if (current.length >= 2) runs.push(current);
      current = [];
      continue;
    }
    current.push(ref);
  }
  if (current.length >= 2) runs.push(current);
  const longest = runs.sort((a, b) => b.length - a.length)[0];
  if (!longest) return [];
  const coordinates = longest.map((id) => nodes.get(id));
  if (!coordinates.some((node) => inside(node.lon, node.lat, district))) return [];
  return [{ id: way.id, tags: way.tags, refs: longest }];
}

function pickTags(tags, keys) {
  if (!tags) return {};
  const picked = {};
  for (const key of keys) {
    if (tags[key]) picked[key] = tags[key];
  }
  return picked;
}

function renderTags(tags) {
  return Object.entries(tags)
    .map(([key, value]) => `<tag k="${escapeXml(key)}" v="${escapeXml(value)}"/>`)
    .join("");
}

function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
