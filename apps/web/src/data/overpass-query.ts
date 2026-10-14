import type { BBox } from "@/domain/road";

export function overpassQuery(bbox: BBox, highways: readonly string[]): string {
  const pattern = highways.join("|");
  return `[out:json][timeout:25];
way["highway"~"^(${pattern})$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
out geom;`;
}
