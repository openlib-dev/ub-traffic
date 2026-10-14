import { describe, expect, it } from "vitest";
import { classifyTemplates } from "@/domain/template";
import type { RoadEdit } from "@/domain/simulation";

function added(wayId: number): RoadEdit {
  return {
    wayId,
    op: "add",
    kind: "highway",
    modes: ["car"],
    start: { longitude: 106.9, latitude: 47.92 },
    end: { longitude: 106.91, latitude: 47.92 },
  };
}

describe("classifyTemplates", () => {
  it("marks a link that is only on one template", () => {
    const rows = classifyTemplates([added(1)], [added(2)]);
    expect(rows).toEqual([
      { edit: added(1), side: "first" },
      { edit: added(2), side: "second" },
    ]);
  });

  it("marks a shared road as both", () => {
    const rows = classifyTemplates([added(1), { wayId: 9, op: "close" }], [{ wayId: 9, op: "close" }]);
    expect(rows.find((row) => row.edit.wayId === 9)?.side).toBe("both");
    expect(rows.find((row) => row.edit.wayId === 1)?.side).toBe("first");
  });
});
