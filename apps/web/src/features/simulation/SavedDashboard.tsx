import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeSevereDifference } from "@/domain/comparison";
import { describeEdit } from "@/domain/scenario";
import {
  compareBottlenecks,
  listBottlenecks,
  sameClock,
  savedRequestBody,
  seriesComparison,
  type BottleneckRow,
  type SavedListItem,
  type SavedRecord,
} from "@/domain/saved-result";
import type { SimulationConfig, SimulationFrame } from "@/domain/simulation";
import { createSavedResult, deleteSavedResult, fetchSavedResult, listSavedResults } from "@/data/simulation-client";
import { DashboardChart } from "@/features/simulation/DashboardChart";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const LIST_LIMIT = 8;

export function SavedDashboard({
  config,
  frames,
  baselineFrames,
  names,
  disabled,
}: {
  config: () => SimulationConfig;
  frames: readonly SimulationFrame[];
  baselineFrames: readonly SimulationFrame[] | null;
  names: ReadonlyMap<number, string>;
  disabled: boolean;
}) {
  const { copy, show } = useI18n();
  const reference = useAppStore((state) => state.dashboardReference);
  const changed = useAppStore((state) => state.dashboardChanged);
  const setSelection = useAppStore((state) => state.setDashboardSelection);
  const availability = useAppStore((state) => state.simulationAvailability);
  const [items, setItems] = useState<SavedListItem[]>([]);
  const [name, setName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chartId, setChartId] = useState<string | null>(null);

  async function refresh() {
    setItems(await listSavedResults());
  }

  useEffect(() => {
    if (availability !== "connected") return;
    void refresh().catch(() => setError("The saved results could not be read."));
  }, [availability]);

  async function save(label: string, nextConfig: SimulationConfig, source: readonly SimulationFrame[]) {
    if (!label.trim() || source.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createSavedResult(savedRequestBody(label, nextConfig, source, names));
      setName("");
      setBaselineName("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The result could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: string, side: "reference" | "changed") {
    setError(null);
    try {
      const record = await fetchSavedResult(id);
      if (side === "reference") setSelection(record, changed?.id === id ? null : changed);
      else setSelection(reference?.id === id ? null : reference, record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The saved results could not be read.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deleteSavedResult(id);
      setSelection(reference?.id === id ? null : reference, changed?.id === id ? null : changed);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The saved results could not be read.");
    }
  }

  const rows = rowsFor(reference, changed);
  const aligned = reference && changed && sameClock(reference, changed);
  const comparisonText =
    reference && changed && aligned
      ? describeSevereDifference(seriesComparison(reference.summary.series, changed.summary.series))
      : null;
  const editText = changed ? editSummary(changed, show) : "";

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.dashboard}</h2>
      {frames.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">{copy.resultName}</span>
            <Input className="h-7 px-2 text-xs" value={name} disabled={disabled || busy} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || busy || name.trim().length === 0}
            onClick={() => void save(name, config(), frames)}
          >
            {baselineFrames ? copy.saveScenario : copy.saveResult}
          </Button>
          {baselineFrames ? (
            <>
              <Input
                className="h-7 px-2 text-xs"
                aria-label={copy.saveBaseline}
                placeholder={copy.saveBaseline}
                value={baselineName}
                disabled={disabled || busy}
                onChange={(event) => setBaselineName(event.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || busy || baselineName.trim().length === 0}
                onClick={() =>
                  void save(baselineName, { ...config(), edits: [], commuteAttractors: false }, baselineFrames)
                }
              >
                {copy.saveBaseline}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? <p className="text-xs text-muted-foreground">{copy.noSaved}</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border px-2 py-2">
            <p className="truncate text-xs text-foreground">{item.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {item.startTime}–{item.endTime} · {item.demandIntensity} · {copy.editCount(item.editCount)} · {copy.severeTotal(item.totalSevereSeconds)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Button size="xs" variant="outline" onClick={() => setChartId(item.id)}>
                {copy.openChart}
              </Button>
              <Button size="xs" variant={reference?.id === item.id ? "secondary" : "ghost"} onClick={() => void choose(item.id, "reference")}>
                {copy.referenceResult}
              </Button>
              <Button size="xs" variant={changed?.id === item.id ? "secondary" : "ghost"} onClick={() => void choose(item.id, "changed")}>
                {copy.changedResult}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => void remove(item.id)}>
                {copy.deleteResult}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {reference && changed && !aligned ? <p className="text-xs text-muted-foreground">{copy.clocksDiffer}</p> : null}
      {comparisonText ? <p className="text-xs leading-relaxed text-foreground">{show(comparisonText)}</p> : null}
      {reference ? <p className="text-xs text-muted-foreground">{copy.severeTotal(reference.summary.totalSevereSeconds)}</p> : null}
      {changed ? (
        <p className="text-xs leading-relaxed text-foreground">{copy.becauseOf(changed.name, editText)}</p>
      ) : null}
      {rows.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {rows.slice(0, LIST_LIMIT).map((row) => (
            <li key={row.roadId} className="text-xs">
              <span className="block truncate text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                {copy.shareOfRun(row.sharePercent)}
                {row.effect?.kind === "percent" ? ` · ${copy.effectOfChange(row.effect.percent)}` : null}
                {row.effect?.kind === "new" ? ` · ${copy.newBottleneck}` : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {error ? <p className="text-xs text-destructive">{show(error)}</p> : null}
      {chartId ? <DashboardChart focusId={chartId} others={items} onClose={() => setChartId(null)} /> : null}
    </section>
  );
}

function rowsFor(reference: SavedRecord | null, changed: SavedRecord | null): BottleneckRow[] {
  if (reference && changed) {
    return compareBottlenecks(reference.summary.roads, changed.summary.roads, changed.summary.totalSevereSeconds);
  }
  if (reference) return listBottlenecks(reference.summary.roads, reference.summary.totalSevereSeconds);
  if (changed) return listBottlenecks(changed.summary.roads, changed.summary.totalSevereSeconds);
  return [];
}

function editSummary(record: SavedRecord, show: (value: string | null | undefined) => string): string {
  return record.edits
    .slice(0, 2)
    .map((edit) => show(describeEdit(edit)))
    .filter(Boolean)
    .join(", ");
}
