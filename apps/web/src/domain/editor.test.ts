import { describe, expect, it } from "vitest";
import type { RoadFeature } from "@/domain/road";
import { commitDrawnPath, rememberEdits, snapDrawPoint, undoEdits } from "@/domain/editor";

const network: RoadFeature[] = [
  {
    id: 10,
    highway: "primary",
    highwayClass: "primary",
    layerGroup: "arterial",
    maxspeedKmh: 60,
    lanes: 2,
    oneway: "unknown",
    structure: "none",
    lengthMeters: 100,
    bbox: { west: 106.91, south: 47.92, east: 106.912, north: 47.922 },
    coordinates: [
      [106.91, 47.92],
      [106.912, 47.922],
    ],
  },
];

describe("canvas drawing", () => {
  it("turns a drag into a snapped polyline", () => {
    const drawn = commitDrawnPath([], {
      tool: "highway",
      points: [
        [106.9102, 47.9202],
        [106.9118, 47.9218],
      ],
      roads: network,
    });
    expect(drawn.error).toBeNull();
    const edit = drawn.edits[0];
    expect(edit?.op).toBe("add");
    if (edit?.op !== "add") return;
    expect(edit.kind).toBe("highway");
    expect(edit.points?.map((point) => [point.longitude, point.latitude])).toEqual([
      [106.91, 47.92],
      [106.912, 47.922],
    ]);
  });

  it("refuses a drag that does not meet a loaded road", () => {
    const drawn = commitDrawnPath([], {
      tool: "highway",
      points: [
        [106.93, 47.93],
        [106.94, 47.94],
      ],
      roads: network,
    });
    expect(drawn.error).toMatch(/existing road/);
    expect(drawn.edits).toEqual([]);
  });

  it("lands a drag on the road segment under the pointer", () => {
    const long: RoadFeature = {
      ...network[0]!,
      coordinates: [
        [106.9, 47.92],
        [106.93, 47.92],
      ],
    };
    const drawn = commitDrawnPath([], {
      tool: "road",
      points: [
        [106.915, 47.9201],
        [106.912, 47.922],
      ],
      roads: [long, network[0]!],
    });
    expect(drawn.error).toBeNull();
    const edit = drawn.edits[0];
    if (edit?.op !== "add") throw new Error("missing link");
    expect(edit.points?.[0]?.latitude).toBeCloseTo(47.92, 4);
    expect(edit.points?.[0]?.longitude).toBeCloseTo(106.915, 3);
  });

  it("leaves a point where it was clicked when Alt is held", () => {
    const drawn = commitDrawnPath([], {
      tool: "road",
      alt: true,
      points: [
        [106.9104, 47.9204],
        [106.93, 47.93],
      ],
      roads: network,
    });
    expect(drawn.error).toBeNull();
    const edit = drawn.edits[0];
    if (edit?.op !== "add") throw new Error("missing link");
    expect(edit.points?.[0]).toMatchObject({ longitude: 106.9104, latitude: 47.9204 });
  });

  it("restores the previous edits on undo", () => {
    const drawn = commitDrawnPath([], {
      tool: "street",
      points: [
        [106.91, 47.92],
        [106.912, 47.922],
      ],
      roads: network,
    });
    const remembered = rememberEdits([], [], drawn.edits);
    expect(remembered).not.toBeNull();
    const undone = undoEdits(remembered!.past, remembered!.present, remembered!.future);
    expect(undone?.present).toEqual([]);
  });

  it("does not snap a subway onto a surface road", () => {
    const snapped = snapDrawPoint([106.9104, 47.9204], network, [], "subway", false);
    expect(snapped.snapped).toBe(false);
    expect(snapped.point).toEqual([106.9104, 47.9204]);
  });
});
