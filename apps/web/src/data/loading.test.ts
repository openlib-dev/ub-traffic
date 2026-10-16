import { describe, expect, it } from "vitest";
import { overpassQuery } from "@/data/overpass-query";
import { parseNominatimResults } from "@/data/nominatim";
import { parseLocalExtract, roadsForLane, roadsInView } from "@/data/local-roads";
import { laneChain, type RoadFeature } from "@/domain/road";
import { roadsFromOverpassPayload } from "@/data/overpass-road-source";

describe("overpassQuery", () => {
  it("uses Overpass bbox order south, west, north, east", () => {
    const query = overpassQuery(
      { west: 106.8, south: 47.8, east: 107.0, north: 48.0 },
      ["primary", "primary_link"],
    );
    expect(query).toContain('way["highway"~"^(primary|primary_link)$"](47.8,106.8,48,107);');
  });
});

describe("parseNominatimResults", () => {
  it("reads a place center and bounding box", () => {
    const [place] = parseNominatimResults([
      {
        place_id: 9,
        display_name: "Ulaanbaatar, Mongolia",
        lat: "47.9212",
        lon: "106.9186",
        boundingbox: ["47.8", "48.0", "106.7", "107.1"],
      },
    ]);
    expect(place).toMatchObject({
      id: "9",
      label: "Ulaanbaatar, Mongolia",
      latitude: 47.9212,
      longitude: 106.9186,
      bbox: { south: 47.8, north: 48.0, west: 106.7, east: 107.1 },
    });
  });
});

describe("roadsFromOverpassPayload", () => {
  it("skips elements that are not drawable ways", () => {
    const roads = roadsFromOverpassPayload({
      elements: [
        { type: "node", id: 1 },
        {
          type: "way",
          id: 2,
          tags: { highway: "residential", name: "Local" },
          geometry: [
            { lon: 106.9, lat: 47.9 },
            { lon: 106.91, lat: 47.9 },
          ],
        },
      ],
    });
    expect(roads.map((road) => road.id)).toEqual([2]);
  });
});

describe("local extract", () => {
  const extract = parseLocalExtract({
    coverage: { west: 106.7, south: 47.8, east: 107.2, north: 48.1 },
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 11,
        properties: { highway: "primary", name: "Peace Avenue", maxspeed: "60" },
        geometry: {
          type: "LineString",
          coordinates: [
            [106.9, 47.91],
            [106.92, 47.92],
          ],
        },
      },
      {
        type: "Feature",
        id: 12,
        properties: { highway: "residential", name: "Side street" },
        geometry: {
          type: "LineString",
          coordinates: [
            [106.91, 47.915],
            [106.93, 47.916],
          ],
        },
      },
    ],
  });

  it("keeps roads inside the view and the requested classes", () => {
    const visible = roadsInView(
      extract?.roads ?? [],
      { west: 106.89, south: 47.9, east: 106.93, north: 47.93 },
      { zoom: 12, layers: { arterials: true, local: true, service: false } },
    );
    expect(visible.map((road) => road.id)).toEqual([11]);
    expect(visible[0]?.name).toBe("Peace Avenue");
    expect(visible[0]?.maxspeedKmh).toBe(60);
  });
});

describe("roadsForLane", () => {
  it("joins a named lane through pieces that are outside the loaded view", () => {
    const visible = piece(1, [106.9, 47.92], [106.901, 47.92]);
    const beyond = piece(2, [106.901, 47.92], [106.95, 47.92]);
    const pool = roadsForLane([visible], [visible, beyond]);
    expect(laneChain(pool, 1).sort()).toEqual([1, 2]);
  });
});

function piece(id: number, start: RoadFeature["coordinates"][number], end: RoadFeature["coordinates"][number]): RoadFeature {
  return {
    id,
    highway: "primary",
    highwayClass: "primary",
    layerGroup: "arterial",
    name: "Peace Avenue",
    maxspeedKmh: 60,
    lanes: 2,
    oneway: "yes",
    structure: "none",
    lengthMeters: 80,
    bbox: { west: start[0], south: start[1], east: end[0], north: end[1] },
    coordinates: [start, end],
  };
}
