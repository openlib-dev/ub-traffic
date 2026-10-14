import type { SavedSummary } from "@/domain/saved-result";
import type { RoadEdit } from "@/domain/simulation";

export type TemplateSide = "first" | "second" | "both";

export type RoadTemplate = {
  key: string;
  name: string;
  edits: RoadEdit[];
  summary: SavedSummary | null;
};

export type ClassifiedEdit = {
  edit: RoadEdit;
  side: TemplateSide;
};

export function savedTemplate(record: { id: string; name: string; edits: RoadEdit[]; summary: SavedSummary }): RoadTemplate {
  return { key: `saved:${record.id}`, name: record.name, edits: record.edits, summary: record.summary };
}

export function classifyTemplates(first: readonly RoadEdit[], second: readonly RoadEdit[]): ClassifiedEdit[] {
  const left = new Map(first.map((edit) => [edit.wayId, edit]));
  const right = new Map(second.map((edit) => [edit.wayId, edit]));
  const rows: ClassifiedEdit[] = [];
  for (const wayId of new Set([...left.keys(), ...right.keys()])) {
    const before = left.get(wayId);
    const after = right.get(wayId);
    if (before && after) rows.push({ edit: before, side: "both" });
    else if (before) rows.push({ edit: before, side: "first" });
    else if (after) rows.push({ edit: after, side: "second" });
  }
  return rows;
}
