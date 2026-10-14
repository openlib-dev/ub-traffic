import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { patchDrawn } from "@/domain/editor";
import {
  displayName,
  formatHighway,
  formatLanes,
  formatLength,
  formatOneway,
  formatSpeed,
  formatStructure,
  formatSurface,
} from "@/domain/road";
import type { LinkKind } from "@/domain/simulation";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

export function RoadInspector() {
  const { copy, show } = useI18n();
  const selectedRoadId = useAppStore((state) => state.selectedRoadId);
  const road = useAppStore((state) => state.roads.find((item) => item.id === state.selectedRoadId) ?? null);
  const current = useAppStore((state) => state.edits.find((edit) => edit.wayId === state.selectedRoadId));
  const drawn = useAppStore((state) => {
    const id = state.selectedEditIds[0];
    const edit = state.edits.find((item) => item.wayId === id && item.op === "add");
    return edit?.op === "add" ? edit : null;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.roadHeading}</p>
        <h2 className="mt-1 text-base leading-snug font-medium">
          {road ? displayName(road) : drawn ? drawn.name || kindTitle(drawn.kind, copy) : copy.nothingSelected}
        </h2>
        {road?.name && road.nameEn && road.nameEn !== road.name ? (
          <p className="mt-1 text-sm text-muted-foreground">{road.nameEn}</p>
        ) : null}
      </header>
      {road ? (
        <div className="flex flex-col gap-4 px-4 py-4">
          <Badge variant="outline">{show(formatHighway(road.highway))}</Badge>
          <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <Property
              term={copy.speedLimit}
              value={withOverride(
                show(formatSpeed(road.maxspeedKmh)),
                current?.op === "maxspeed" ? show(`${current.maxspeedKmh} km/h`) : null,
                copy.scenarioOverride,
              )}
            />
            <Property
              term={copy.lanes}
              value={withOverride(formatLanes(road.lanes), current?.op === "lanes" ? String(current.lanes) : null, copy.scenarioOverride)}
            />
            <Property term={copy.direction} value={show(formatOneway(road.oneway))} />
            <Property term={copy.structure} value={show(formatStructure(road.structure))} />
            <Property term={copy.surface} value={show(formatSurface(road.surface))} />
            <Property term={copy.length} value={show(formatLength(road.lengthMeters))} />
            <dt className="text-muted-foreground">OSM id</dt>
            <dd>
              <a
                className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                href={`https://www.openstreetmap.org/way/${road.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {road.id}
              </a>
            </dd>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">{copy.inspectorNote}</p>
        </div>
      ) : drawn ? (
        <DrawnProperties key={drawn.wayId} wayId={drawn.wayId} />
      ) : (
        <div className="px-4 py-4 text-sm leading-relaxed text-muted-foreground">
          <p>{copy.clickRoad}</p>
          {selectedRoadId ? <p className="mt-2">{copy.wayGone}</p> : null}
        </div>
      )}
    </div>
  );
}

function kindTitle(kind: LinkKind, copy: ReturnType<typeof useI18n>["copy"]): string {
  if (kind === "highway") return copy.highway;
  if (kind === "subway") return copy.subway;
  if (kind === "street") return copy.toolStreet;
  if (kind === "railway") return copy.toolRailway;
  if (kind === "bridge") return copy.toolBridge;
  if (kind === "intersection") return copy.toolIntersection;
  if (kind === "signal") return copy.toolSignal;
  return copy.road;
}

function DrawnProperties({ wayId }: { wayId: number }) {
  const { copy } = useI18n();
  const edit = useAppStore((state) => state.edits.find((item) => item.op === "add" && item.wayId === wayId));
  const setEdits = useAppStore((state) => state.setEdits);
  const edits = useAppStore((state) => state.edits);
  const [name, setName] = useState(edit?.op === "add" ? edit.name ?? "" : "");
  const [lanes, setLanes] = useState(edit?.op === "add" ? String(edit.lanes ?? 2) : "2");
  const [speed, setSpeed] = useState(edit?.op === "add" ? String(edit.maxspeedKmh ?? 50) : "50");
  const [stops, setStops] = useState(edit?.op === "add" ? String(edit.stops ?? 2) : "2");
  if (!edit || edit.op !== "add") return null;
  const subway = edit.kind === "subway" || edit.kind === "railway";

  function apply(patch: Parameters<typeof patchDrawn>[2]) {
    setEdits(patchDrawn(edits, wayId, patch));
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 text-sm">
      <Badge variant="outline">{edit.kind}</Badge>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {copy.nameOptional}
        <Input className="h-7 text-xs" value={name} onChange={(event) => {
          setName(event.target.value);
          apply({ name: event.target.value });
        }} />
      </label>
      {subway ? (
        <>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {copy.drawnStops}
            <Input className="h-7 w-14 text-xs" inputMode="numeric" value={stops} onChange={(event) => {
              setStops(event.target.value);
              const count = Number(event.target.value);
              if (Number.isInteger(count) && count > 0) apply({ stops: count });
            }} />
          </label>
          <p className="text-xs text-muted-foreground">{copy.capacityNote}</p>
          <p className="text-xs text-muted-foreground">{copy.frequencyNote}</p>
        </>
      ) : edit.kind === "intersection" || edit.kind === "signal" ? null : (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {copy.chooseLink}
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              value={edit.kind}
              onChange={(event) => apply({ kind: event.target.value as LinkKind })}
            >
              {(["road", "highway", "street", "bridge"] as LinkKind[]).map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {copy.laneCount}
            <Input className="h-7 w-14 text-xs" inputMode="numeric" value={lanes} onChange={(event) => setLanes(event.target.value)} />
            <Button size="sm" variant="outline" onClick={() => apply({ lanes: Number(lanes) })}>{copy.setLanes}</Button>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {copy.drawnDirection}
            <Button size="sm" variant={edit.oneway ? "outline" : "default"} onClick={() => apply({ oneway: false })}>{copy.twoWay}</Button>
            <Button size="sm" variant={edit.oneway ? "default" : "outline"} onClick={() => apply({ oneway: true })}>{copy.oneWay}</Button>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {copy.speedLimit}
            <Input className="h-7 w-14 text-xs" inputMode="numeric" value={speed} onChange={(event) => setSpeed(event.target.value)} />
            <Button size="sm" variant="outline" onClick={() => apply({ maxspeedKmh: Number(speed) })}>{copy.setSpeed}</Button>
          </label>
        </>
      )}
    </div>
  );
}

function withOverride(
  published: string,
  override: string | null,
  join: (published: string, override: string) => string,
): string {
  return override ? join(published, override) : published;
}

function Property({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-mono text-xs leading-5">{value}</dd>
    </>
  );
}
