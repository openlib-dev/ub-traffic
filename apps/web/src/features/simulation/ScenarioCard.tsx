import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { displayName } from "@/domain/road";
import { describeZaisanWindow, commitEdit, describeEdit, removeEdit, scenarioRunError } from "@/domain/scenario";
import type { RoadEdit, VehicleMode } from "@/domain/simulation";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

export function ScenarioCard({ startTime, endTime }: { startTime: string; endTime: string }) {
  const { copy, show } = useI18n();
  const roads = useAppStore((state) => state.roads);
  const edits = useAppStore((state) => state.edits);
  const setEdits = useAppStore((state) => state.setEdits);
  const commuteAttractors = useAppStore((state) => state.commuteAttractors);
  const setCommuteAttractors = useAppStore((state) => state.setCommuteAttractors);
  const selected = useAppStore((state) => state.roads.find((road) => road.id === state.selectedRoadId) ?? null);
  const editable = useAppStore(
    (state) => !state.templateBase && state.mapTemplates.length === 1 && state.mapTemplates[0].key.startsWith("template:"),
  );
  const running = useAppStore((state) => state.runStatus === "running");
  const runError = scenarioRunError(edits);

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.scenario}</p>
      {editable && selected ? (
        <RoadActions key={selected.id} wayId={selected.id} name={displayName(selected)} disabled={running} />
      ) : null}
      {editable && !selected ? <p className="text-xs text-muted-foreground">{copy.selectOrDraw}</p> : null}
      {!editable ? <p className="text-xs text-muted-foreground">{copy.baseMapLocked}</p> : null}

      <label className="flex items-center justify-between gap-2 text-xs text-foreground">
        {copy.morningCommute}
        <Switch
          size="sm"
          checked={commuteAttractors}
          disabled={running}
          aria-label={copy.morningCommute}
          onCheckedChange={setCommuteAttractors}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {copy.commuteHelp}
      </p>
      <p className="text-xs text-foreground">{copy.zaisan}</p>
      {describeZaisanWindow(startTime, endTime) ? (
        <p className="text-xs text-muted-foreground">{show(describeZaisanWindow(startTime, endTime))}</p>
      ) : null}

      {runError ? <p className="text-xs text-destructive">{show(runError)}</p> : null}
      {editable ? <EditList edits={edits} roads={roads} setEdits={setEdits} /> : null}
    </div>
  );
}

function RoadActions({ wayId, name, disabled }: { wayId: number; name: string; disabled: boolean }) {
  const { copy, show } = useI18n();
  const edits = useAppStore((state) => state.edits);
  const setEdits = useAppStore((state) => state.setEdits);
  const roads = useAppStore((state) => state.roads);
  const selectedRoadIds = useAppStore((state) => state.selectedRoadIds);
  const road = roads.find((item) => item.id === wayId) ?? null;
  const [lanes, setLanes] = useState(road?.lanes ? String(road.lanes) : "2");
  const [speed, setSpeed] = useState(road?.maxspeedKmh ? String(road.maxspeedKmh) : "40");
  const [modes, setModes] = useState<VehicleMode[]>(["car"]);
  const [error, setError] = useState<string | null>(null);

  function apply(make: (wayId: number) => RoadEdit) {
    const ids = selectedRoadIds.length > 0 ? selectedRoadIds : [wayId];
    let next = edits;
    for (const id of ids) {
      const piece = roads.find((item) => item.id === id);
      if (!piece) continue;
      const result = commitEdit(next, make(id), piece.bbox);
      if (result.error) {
        setError(result.error);
        if (next !== edits) setEdits(next);
        return;
      }
      next = result.edits;
    }
    setError(null);
    setEdits(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground">{name}</p>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "close" }))}>
        {copy.closeRoad}
      </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "park" }))}>
        {copy.parkLane}
      </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "stall" }))}>
        {copy.stallLane}
      </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "construction" }))}>
        {copy.roadWork}
      </Button>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {copy.laneCount}
        <Input className="h-7 w-14 text-xs" inputMode="numeric" value={lanes} disabled={disabled} onChange={(event) => setLanes(event.target.value)} />
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "lanes", lanes: Number(lanes) }))}>
          {copy.setLanes}
        </Button>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {copy.speedLimit}
        <Input className="h-7 w-14 text-xs" inputMode="numeric" value={speed} disabled={disabled} onChange={(event) => setSpeed(event.target.value)} />
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "maxspeed", maxspeedKmh: Number(speed) }))}>
          {copy.setSpeed}
        </Button>
      </label>
      <ModeChecks modes={modes} disabled={disabled} onChange={setModes} />
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply((id) => ({ wayId: id, op: "access", modes }))}>
        {copy.setAccess}
      </Button>
      {error ? <p className="text-xs text-destructive">{show(error)}</p> : null}
    </div>
  );
}

function ModeChecks({
  modes,
  disabled,
  onChange,
}: {
  modes: VehicleMode[];
  disabled: boolean;
  onChange: (modes: VehicleMode[]) => void;
}) {
  const { copy } = useI18n();
  const modeLabels: { id: VehicleMode; label: string }[] = [
    { id: "car", label: copy.cars },
    { id: "bus", label: copy.buses },
    { id: "truck", label: copy.trucks },
    { id: "train", label: copy.trains },
  ];

  function toggle(mode: VehicleMode) {
    onChange(modes.includes(mode) ? modes.filter((item) => item !== mode) : [...modes, mode]);
  }

  return (
    <div className="flex flex-col gap-1">
      {modeLabels.map((mode) => (
        <label key={mode.id} className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={modes.includes(mode.id)} disabled={disabled} onChange={() => toggle(mode.id)} />
          {mode.label}
        </label>
      ))}
    </div>
  );
}

function EditList({
  edits,
  roads,
  setEdits,
}: {
  edits: RoadEdit[];
  roads: { id: number; name?: string; nameEn?: string }[];
  setEdits: (edits: RoadEdit[]) => void;
}) {
  const { copy, show } = useI18n();
  if (edits.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{copy.nextRunChanges}</p>
        <Button size="xs" variant="ghost" onClick={() => setEdits([])}>
          {copy.clear}
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {edits.map((edit) => {
          const road = roads.find((item) => item.id === edit.wayId);
          const label = road ? displayName(road) : undefined;
          return (
            <li key={edit.wayId} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-foreground">{show(describeEdit(edit, label))}</span>
              <Button size="xs" variant="ghost" onClick={() => setEdits(removeEdit(edits, edit.wayId))}>
                {copy.remove}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
