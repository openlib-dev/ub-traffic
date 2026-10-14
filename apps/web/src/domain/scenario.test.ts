import { describe, expect, it } from "vitest";
import type { RoadFeature } from "@/domain/road";
import { MORNING_PEAK } from "@/domain/preset";
import { commitAdd, commitEdit, describeZaisanWindow, snapEnd, tripSplit, type RoadEdit } from "@/domain/scenario";
import { toRoadCollection } from "@/map/roads-geojson";

const inside = { west: 106.91, south: 47.92, east: 106.92, north: 47.925 };
const outside = { west: 107.2, south: 47.2, east: 107.3, north: 47.3 };

describe("commitEdit", () => {
  it("accepts a close, a lane change, and a speed change inside the district", () => {
    const close = commitEdit([], { wayId: 11, op: "close" }, inside);
    const lanes = commitEdit([], { wayId: 12, op: "lanes", lanes: 3 }, inside);
    const speed = commitEdit([], { wayId: 13, op: "maxspeed", maxspeedKmh: 40 }, inside);
    expect(close.error).toBeNull();
    expect(lanes.error).toBeNull();
    expect(speed.error).toBeNull();
    expect(close.edits).toEqual([{ wayId: 11, op: "close" }]);
    expect(lanes.edits).toEqual([{ wayId: 12, op: "lanes", lanes: 3 }]);
    expect(speed.edits).toEqual([{ wayId: 13, op: "maxspeed", maxspeedKmh: 40 }]);
    expect(MORNING_PEAK.district.west).toBe(106.75);
  });

  it("replaces a second edit on the same way", () => {
    const first = commitEdit([], { wayId: 5, op: "close" }, inside);
    const second = commitEdit(first.edits, { wayId: 5, op: "lanes", lanes: 2 }, inside);
    expect(second.edits).toEqual<RoadEdit[]>([{ wayId: 5, op: "lanes", lanes: 2 }]);
    const access = commitEdit(second.edits, { wayId: 5, op: "access", modes: ["bus", "car"] }, inside);
    expect(access.edits).toEqual<RoadEdit[]>([{ wayId: 5, op: "access", modes: ["car", "bus"] }]);
  });

  it("accepts parking, a stall, and road work", () => {
    expect(commitEdit([], { wayId: 11, op: "park" }, inside).edits).toEqual([{ wayId: 11, op: "park" }]);
    expect(commitEdit([], { wayId: 12, op: "stall" }, inside).edits).toEqual([{ wayId: 12, op: "stall" }]);
    expect(commitEdit([], { wayId: 13, op: "construction" }, inside).edits).toEqual([
      { wayId: 13, op: "construction" },
    ]);
  });

  it("accepts a road outside Sukhbaatar", () => {
    expect(commitEdit([], { wayId: 8, op: "close" }, outside).error).toBeNull();
  });

  it("rejects lanes and speeds outside the allowed range", () => {
    expect(commitEdit([], { wayId: 8, op: "lanes", lanes: 0 }, inside).error).toMatch(/1 to 4/);
    expect(commitEdit([], { wayId: 8, op: "lanes", lanes: 5 }, inside).error).toMatch(/1 to 4/);
    expect(commitEdit([], { wayId: 8, op: "maxspeed", maxspeedKmh: 9 }, inside).error).toMatch(/10 to 90/);
    expect(commitEdit([], { wayId: 8, op: "maxspeed", maxspeedKmh: 91 }, inside).error).toMatch(/10 to 90/);
  });
});

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
  bbox: inside,
  coordinates: [
    [106.91, 47.92],
    [106.92, 47.925],
  ],
};

const network: RoadFeature[] = [
  {
    ...road,
    coordinates: [
      [106.91, 47.92],
      [106.912, 47.922],
    ],
  },
];

describe("commitAdd", () => {
  it("accepts a snapped road, highway, and subway", () => {
    const start: [number, number] = [106.91, 47.92];
    const end: [number, number] = [106.912, 47.922];
    const added = commitAdd([], { kind: "highway", modes: ["car", "bus"], start, end }, network);
    expect(added.error).toBeNull();
    expect(added.edits[0]).toMatchObject({ op: "add", kind: "highway", modes: ["car", "bus"] });
    const subway = commitAdd(added.edits, { kind: "subway", modes: ["train"], start, end }, network);
    expect(subway.error).toBeNull();
    expect(subway.edits).toHaveLength(2);
    const street = commitAdd([], { kind: "road", modes: ["car"], start, end }, network);
    expect(street.edits[0]).toMatchObject({ kind: "road" });
  });

  it("attaches a click on the road line to the nearest corner", () => {
    const span: RoadFeature = {
      ...road,
      coordinates: [
        [106.91, 47.92],
        [106.91, 47.923],
      ],
    };
    const middle: [number, number] = [106.91, 47.9215];
    const snapped = snapEnd(middle, [span]);
    expect(snapped.error).toBeNull();
    expect(snapped.point?.[1] === 47.92 || snapped.point?.[1] === 47.923).toBe(true);
  });

  it("attaches a click on a road outside Sukhbaatar", () => {
    const elsewhere: RoadFeature = {
      ...road,
      id: 80,
      bbox: outside,
      coordinates: [
        [107.21, 47.21],
        [107.22, 47.22],
      ],
    };
    const snapped = snapEnd([107.215, 47.215], [elsewhere]);
    expect(snapped.error).toBeNull();
    expect(snapped.point).not.toBeNull();
    expect(snapped.along).not.toBeNull();
  });

  it("rejects an end that does not meet a loaded road", () => {
    const far = commitAdd(
      [],
      { kind: "road", modes: ["car"], start: [106.91, 47.92], end: [106.93, 47.93] },
      network,
    );
    expect(far.error).toMatch(/existing road/);
    expect(snapEnd([106.93, 47.93], network).error).toMatch(/existing road/);
  });

  it("rejects a link with no allowed vehicles", () => {
    const start: [number, number] = [106.91, 47.92];
    const end: [number, number] = [106.912, 47.922];
    expect(commitAdd([], { kind: "road", modes: [], start, end }, network).error).toMatch(/at least one/);
  });
});

describe("tripSplit", () => {
  it("splits 40 vehicles across cars and trains as 20 and 20", () => {
    expect(tripSplit(40, ["train", "car"])).toEqual([
      { mode: "car", count: 20 },
      { mode: "train", count: 20 },
    ]);
  });
});

describe("describeZaisanWindow", () => {
  it("stays quiet during the morning preset, when the slow signal is on the whole time", () => {
    expect(describeZaisanWindow("07:30", "07:45")).toBeNull();
  });

  it("says the signal stays normal during work hours", () => {
    expect(describeZaisanWindow("10:00", "10:15")).toMatch(/normal signal/);
  });

  it("says the signal changes when the window crosses 09:00", () => {
    expect(describeZaisanWindow("08:50", "09:05")).toMatch(/crosses 09:00/);
  });
});

describe("scenario paint", () => {
  it("marks a closed way and a changed way, and leaves other ways alone", () => {
    const collection = toRoadCollection([road], 15, { arterials: true, local: true, service: false }, null, new Map([[10, "close"]]));
    expect(collection.features[0]?.properties?.scenario).toBe("closed");
    const changed = toRoadCollection([road], 15, { arterials: true, local: true, service: false }, null, new Map([[10, "lanes"]]));
    expect(changed.features[0]?.properties?.scenario).toBe("changed");
    const plain = toRoadCollection([road], 15, { arterials: true, local: true, service: false }, null, new Map());
    expect(plain.features[0]?.properties).not.toHaveProperty("scenario");
  });
});
