import { describe, expect, it } from "vitest";
import {
  bboxOf,
  chooseRoadNames,
  displayName,
  highwayFiltersForLoad,
  lengthMeters,
  mergeRoads,
  parseLanes,
  parseMaxspeed,
  parseOneway,
  pruneRoads,
  roadFromOverpassWay,
  type LayerToggles,
  type RoadFeature,
} from "@/domain/road";
import { CONGESTION_COLOR } from "@/domain/simulation";

const allLayers: LayerToggles = { arterials: true, local: true, service: true };

describe("parseMaxspeed", () => {
  it("parses kilometer limits", () => {
    expect(parseMaxspeed("60")).toBe(60);
    expect(parseMaxspeed("50 km/h")).toBe(50);
  });

  it("converts miles per hour", () => {
    expect(parseMaxspeed("50 mph")).toBe(80);
  });

  it("does not guess non-numeric limits", () => {
    expect(parseMaxspeed("signals")).toBeNull();
    expect(parseMaxspeed("RU:urban")).toBeNull();
    expect(parseMaxspeed(undefined)).toBeNull();
  });
});

describe("parseLanes", () => {
  it("reads the first lane count", () => {
    expect(parseLanes("2")).toBe(2);
    expect(parseLanes("2;3")).toBe(2);
  });

  it("rejects values that are not a lane count", () => {
    expect(parseLanes("none")).toBeNull();
    expect(parseLanes("2.5")).toBeNull();
  });
});

describe("parseOneway", () => {
  it("recognizes direction tags", () => {
    expect(parseOneway("yes")).toBe("yes");
    expect(parseOneway("-1")).toBe("reverse");
    expect(parseOneway("no")).toBe("no");
    expect(parseOneway(undefined)).toBe("unknown");
  });
});

describe("chooseRoadNames", () => {
  it("keeps the local name and a separate English name", () => {
    const names = chooseRoadNames({
      name: "Энхтайваны өргөн чөлөө",
      "name:en": "Peace Avenue",
    });
    expect(names.name).toBe("Энхтайваны өргөн чөлөө");
    expect(names.nameEn).toBe("Peace Avenue");
    expect(displayName(names)).toBe("Энхтайваны өргөн чөлөө");
  });

  it("falls back to the Mongolian name tag, then English", () => {
    expect(chooseRoadNames({ "name:mn": "Баруун 4 зам" }).name).toBe("Баруун 4 зам");
    expect(displayName(chooseRoadNames({ "name:en": "Peace Avenue" }))).toBe("Peace Avenue");
  });
});

describe("highwayFiltersForLoad", () => {
  it("loads arterials and link roads below zoom 13", () => {
    const highways = highwayFiltersForLoad({ zoom: 12, layers: allLayers });
    expect(highways).toContain("motorway");
    expect(highways).toContain("primary_link");
    expect(highways).toContain("tertiary");
    expect(highways).not.toContain("residential");
    expect(highways).not.toContain("service");
  });

  it("adds local streets from zoom 13 and service roads from zoom 16", () => {
    const mid = highwayFiltersForLoad({ zoom: 14, layers: allLayers });
    expect(mid).toContain("residential");
    expect(mid).toContain("living_street");
    expect(mid).not.toContain("service");

    const close = highwayFiltersForLoad({ zoom: 16, layers: allLayers });
    expect(close).toContain("service");
    expect(highwayFiltersForLoad({ zoom: 16, layers: { ...allLayers, service: false } })).not.toContain(
      "service",
    );
  });
});

describe("pruneRoads", () => {
  it("drops ways far outside the view and keeps ways inside the margin", () => {
    const view = { west: 0, south: 0, east: 1, north: 1 };
    const inside = roadBetween(1, 0.2, 0.2, 0.4, 0.4);
    const nearby = roadBetween(2, 1.2, 0.2, 1.3, 0.3);
    const distant = roadBetween(3, 4, 4, 4.2, 4.2);
    const kept = pruneRoads([inside, nearby, distant], view, 0.5);
    expect(kept.map((road) => road.id)).toEqual([1, 2]);
  });

  it("replaces an existing way when the same OSM id is loaded again", () => {
    const original = roadBetween(7, 0, 0, 1, 1);
    const updated = { ...roadBetween(7, 0, 0, 1, 1), name: "Peace Avenue" };
    const merged = mergeRoads([original], [updated]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Peace Avenue");
  });
});

describe("roadFromOverpassWay", () => {
  it("builds a road from OSM tags and geometry", () => {
    const road = roadFromOverpassWay({
      type: "way",
      id: 42,
      tags: {
        highway: "primary",
        name: "Энхтайваны өргөн чөлөө",
        "name:en": "Peace Avenue",
        maxspeed: "60",
        lanes: "4",
        oneway: "yes",
        bridge: "yes",
        surface: "asphalt",
      },
      geometry: [
        { lon: 106.9, lat: 47.9 },
        { lon: 106.9, lat: 47.91 },
      ],
    });
    expect(road?.id).toBe(42);
    expect(road?.name).toBe("Энхтайваны өргөн чөлөө");
    expect(road?.nameEn).toBe("Peace Avenue");
    expect(road?.maxspeedKmh).toBe(60);
    expect(road?.lanes).toBe(4);
    expect(road?.oneway).toBe("yes");
    expect(road?.structure).toBe("bridge");
    expect(road?.lengthMeters).toBeGreaterThan(1000);
    expect(road?.lengthMeters).toBeLessThan(1200);
  });
});

describe("congestion scale", () => {
  it("reserves a distinct color for each level", () => {
    expect(new Set(Object.values(CONGESTION_COLOR)).size).toBe(4);
  });
});

function roadBetween(
  id: number,
  west: number,
  south: number,
  east: number,
  north: number,
): RoadFeature {
  const coordinates: RoadFeature["coordinates"] = [
    [west, south],
    [east, north],
  ];
  return {
    id,
    highway: "primary",
    highwayClass: "primary",
    layerGroup: "arterial",
    maxspeedKmh: null,
    lanes: null,
    oneway: "unknown",
    structure: "none",
    lengthMeters: lengthMeters(coordinates),
    bbox: bboxOf(coordinates),
    coordinates,
  };
}
