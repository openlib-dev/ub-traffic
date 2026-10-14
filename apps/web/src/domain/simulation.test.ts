import { describe, expect, it } from "vitest";
import type { RoadFeature } from "@/domain/road";
import {
  congestionColor,
  congestionFromRatio,
  CONGESTION_COLOR,
  describeSimulation,
  osmWayIdFromEdge,
  parseSimulationFrame,
  parseSimulationTimeline,
} from "@/domain/simulation";
import { toRoadCollection } from "@/map/roads-geojson";

const layers = { arterials: true, local: true, service: false };

const road: RoadFeature = {
  id: 10,
  highway: "primary",
  highwayClass: "primary",
  layerGroup: "arterial",
  maxspeedKmh: 60,
  lanes: 2,
  oneway: "unknown",
  structure: "none",
  lengthMeters: 100,
  bbox: { west: 106.9, south: 47.91, east: 106.92, north: 47.92 },
  coordinates: [
    [106.91, 47.915],
    [106.915, 47.916],
  ],
};

describe("congestionFromRatio", () => {
  it("keeps the strict speed bands", () => {
    expect(congestionFromRatio(81, 100)).toBe("free");
    expect(congestionFromRatio(80, 100)).toBe("moderate");
    expect(congestionFromRatio(51, 100)).toBe("moderate");
    expect(congestionFromRatio(50, 100)).toBe("heavy");
    expect(congestionFromRatio(26, 100)).toBe("heavy");
    expect(congestionFromRatio(25, 100)).toBe("severe");
    expect(congestionFromRatio(0, 100)).toBe("severe");
    expect(congestionFromRatio(-1, 100)).toBeNull();
    expect(congestionFromRatio(10, 0)).toBeNull();
  });
});

describe("osmWayIdFromEdge", () => {
  it("reads one OpenStreetMap way id from a SUMO edge", () => {
    expect(osmWayIdFromEdge("123#1", "123")).toBe(123);
    expect(osmWayIdFromEdge("456")).toBe(456);
    expect(osmWayIdFromEdge("-89")).toBe(89);
    expect(osmWayIdFromEdge(":cluster_1")).toBeNull();
    expect(osmWayIdFromEdge("12#0", "12 34")).toBeNull();
  });
});

describe("parseSimulationFrame", () => {
  it("drops unknown congestion and invalid vehicles", () => {
    const frame = parseSimulationFrame({
      timestamp: "07:31:00",
      vehicles: [
        { id: "car0", longitude: 106.91, latitude: 47.92, bearing: 10 },
        { id: "bad", longitude: 400, latitude: 47.92, bearing: 0 },
      ],
      segments: [
        { roadId: 10, speedKmh: 12, congestion: "heavy" },
        { roadId: 11, speedKmh: 4, congestion: "gridlock" },
      ],
    });
    expect(frame).toEqual({
      timestamp: "07:31:00",
      vehicles: [{ id: "car0", longitude: 106.91, latitude: 47.92, bearing: 10 }],
      segments: [{ roadId: 10, speedKmh: 12, congestion: "heavy" }],
    });
  });

  it("rejects a timeline frame that has no timestamp", () => {
    expect(
      parseSimulationTimeline({
        runId: "abc",
        frames: [{ vehicles: [], segments: [] }],
      }),
    ).toBeNull();
  });
});

describe("congestion paint", () => {
  it("leaves a road unpainted when it has no metric", () => {
    expect(congestionColor(undefined)).toBeNull();
    expect(congestionColor("severe")).toBe(CONGESTION_COLOR.severe);

    const plain = toRoadCollection([road], 15, layers);
    expect(plain.features[0]?.properties).not.toHaveProperty("congestion");

    const missing = toRoadCollection([road], 15, layers, new Map([[99, "severe"]]));
    expect(missing.features[0]?.properties).not.toHaveProperty("congestion");

    const painted = toRoadCollection([road], 15, layers, new Map([[10, "heavy"]]));
    expect(painted.features[0]?.properties?.congestion).toBe("heavy");
  });
});

describe("describeSimulation", () => {
  it("stays idle until a run publishes a clock", () => {
    expect(describeSimulation({ runStatus: "idle" })).toBe("No active simulation");
    expect(describeSimulation({ runStatus: "running", progressMessage: "Simulating 07:31:00" })).toBe(
      "Simulating 07:31:00",
    );
    expect(describeSimulation({ runStatus: "ready", timestamp: "07:32:00" })).toBe("07:32:00");
    expect(describeSimulation({ runStatus: "cancelled" })).toBe("Simulation cancelled");
  });
});
