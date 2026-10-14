import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchSavedResult } from "@/data/simulation-client";
import { describeEdit } from "@/domain/scenario";
import { compareBottlenecks, sameClock, type SavedListItem, type SavedRecord } from "@/domain/saved-result";
import { savedTemplate } from "@/domain/template";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const COLORS = ["#ef4d4d", "#e2b340", "#3aa0d8", "#3dd68c"];
const MAX_OVERLAY = 4;

export function DashboardChart({
  focusId,
  others,
  onClose,
}: {
  focusId: string;
  others: readonly SavedListItem[];
  onClose: () => void;
}) {
  const { copy, show } = useI18n();
  const setDashboardChartPair = useAppStore((state) => state.setDashboardChartPair);
  const setMapTemplates = useAppStore((state) => state.setMapTemplates);
  const mapTemplates = useAppStore((state) => state.mapTemplates);
  const [focus, setFocus] = useState<SavedRecord | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<SavedRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSavedResult(focusId)
      .then((record) => {
        if (!cancelled) setFocus(record);
      })
      .catch(() => {
        if (!cancelled) setError("The saved results could not be read.");
      });
    return () => {
      cancelled = true;
    };
  }, [focusId]);

  useEffect(() => {
    let cancelled = false;
    const ids = picked.slice(0, MAX_OVERLAY - 1);
    void Promise.all(ids.map((id) => fetchSavedResult(id)))
      .then((records) => {
        if (!cancelled) setLoaded(records);
      })
      .catch(() => {
        if (!cancelled) setError("The saved results could not be read.");
      });
    return () => {
      cancelled = true;
    };
  }, [picked]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runs = focus ? [focus, ...loaded] : loaded;
  const pair = runs.length === 2 && runs[0] && runs[1] ? ([runs[0], runs[1]] as const) : null;
  const aligned = pair ? sameClock(pair[0], pair[1]) : true;
  const bars = pair
    ? compareBottlenecks(pair[1].summary.roads, pair[0].summary.roads, pair[0].summary.totalSevereSeconds).slice(0, 8)
    : [];
  const pairKey = pair ? `${pair[0].id}:${pair[1].id}` : "";

  useEffect(() => {
    setDashboardChartPair(pair);
    return () => setDashboardChartPair(null);
  }, [pairKey, setDashboardChartPair]);

  function showOnMap(record: SavedRecord) {
    setMapTemplates([savedTemplate(record)]);
  }

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_OVERLAY - 1) return current;
      return [...current, id];
    });
  }

  return (
    <section
      role="dialog"
      aria-labelledby="dashboard-chart-title"
      className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-background p-2"
    >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.dashboard}</p>
            <h2 id="dashboard-chart-title" className="mt-1 text-sm font-medium">
              {focus ? focus.name : copy.chartHeading}
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            {copy.closeChart}
          </Button>
        </div>

        {focus ? <RunFacts record={focus} /> : null}
        {error ? <p className="mt-3 text-xs text-destructive">{show(error)}</p> : null}

        <section className="mt-2">
          <h3 className="text-xs font-medium text-muted-foreground">{copy.compareWith}</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {others
              .filter((item) => item.id !== focusId)
              .map((item, index) => {
                const on = picked.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      className="rounded-full border border-border px-2 py-1 text-left text-xs"
                      style={{ borderColor: on ? COLORS[(index % (COLORS.length - 1)) + 1] : undefined }}
                      onClick={() => toggle(item.id)}
                    >
                      {item.name}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {item.editCount === 0 ? copy.normalNetwork : copy.editCount(item.editCount)}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>

        <SeriesChart runs={runs} label={copy.severeChart} />
        <ul className="mt-2 flex flex-col gap-1">
          {runs.map((run, index) => {
            const onMap = mapTemplates.some((template) => template.key === `saved:${run.id}`);
            return (
              <li key={run.id}>
                <button
                  type="button"
                  aria-pressed={onMap}
                  className="flex w-full items-start gap-1.5 rounded-md px-1 py-1 text-left text-xs"
                  style={{ background: onMap ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : undefined }}
                  onClick={() => showOnMap(run)}
                >
                  <span className="mt-1 inline-block size-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="min-w-0">
                    <span className="block truncate">{run.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{networkText(run, copy.normalNetwork, show)}</span>
                    <span className="block text-[11px] text-muted-foreground">{copy.severeTotal(run.summary.totalSevereSeconds)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {pair && !aligned ? <p className="mt-3 text-xs text-muted-foreground">{copy.clocksDiffer}</p> : null}
        {bars.length > 0 ? <RoadBars rows={bars} left={pair![1].name} right={pair![0].name} /> : null}
        {focus && runs.length === 1 ? <RoadBarsSingle record={focus} /> : null}
    </section>
  );
}

function networkText(
  record: SavedRecord,
  normal: string,
  show: (value: string | null | undefined) => string,
): string {
  if (record.edits.length === 0) return normal;
  const lines = record.edits
    .slice(0, 4)
    .map((edit) => show(describeEdit(edit)))
    .filter(Boolean);
  return lines.join(" · ");
}

function RunFacts({ record }: { record: SavedRecord }) {
  const { copy, show } = useI18n();
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <Fact term={copy.start} value={`${record.startTime}–${record.endTime}`} />
      <Fact term={copy.vehicles} value={String(record.demandIntensity)} />
      <Fact term={copy.seed} value={String(record.seed)} />
      <Fact term={copy.morningCommute} value={record.commuteAttractors ? copy.commuteOn : copy.commuteOff} />
      <Fact term={copy.scenario} value={networkText(record, copy.normalNetwork, show)} />
      <Fact term={copy.severeRoads} value={copy.severeTotal(record.summary.totalSevereSeconds)} />
    </dl>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function SeriesChart({ runs, label }: { runs: readonly SavedRecord[]; label: string }) {
  const width = 640;
  const height = 180;
  const pad = 16;
  const longest = Math.max(...runs.map((run) => run.summary.series.length), 2);
  const max = Math.max(...runs.flatMap((run) => run.summary.series.map((point) => point.count)), 1);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="mt-4 h-44 w-full">
      {[0.25, 0.5, 0.75, 1].map((step) => (
        <line
          key={step}
          x1={pad}
          x2={width - pad}
          y1={height - pad - (height - pad * 2) * step}
          y2={height - pad - (height - pad * 2) * step}
          stroke="currentColor"
          strokeOpacity="0.15"
        />
      ))}
      {runs.map((run, index) => {
        const series = run.summary.series;
        if (series.length < 2) return null;
        const step = (width - pad * 2) / (longest - 1);
        const points = series
          .map((sample, sampleIndex) => {
            const x = pad + sampleIndex * step;
            const y = height - pad - (sample.count / max) * (height - pad * 2);
            return `${x},${y}`;
          })
          .join(" ");
        return <polyline key={run.id} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="2" points={points} />;
      })}
    </svg>
  );
}

function RoadBars({
  rows,
  left,
  right,
}: {
  rows: { roadId: number; label: string; referenceSeconds: number; changedSeconds: number; effect: { kind: string; percent?: number } | null }[];
  left: string;
  right: string;
}) {
  const { copy } = useI18n();
  const max = Math.max(...rows.flatMap((row) => [row.referenceSeconds, row.changedSeconds]), 1);
  return (
    <section className="mt-4">
      <h3 className="text-xs font-medium text-muted-foreground">{copy.severeSeconds}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <span className="mr-3">{left}</span>
        <span>{right}</span>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.roadId}>
            <p className="truncate text-xs">{row.label}</p>
            <div className="mt-1 flex flex-col gap-0.5">
              <Bar width={row.referenceSeconds / max} color={COLORS[1]} label={`${row.referenceSeconds}`} />
              <Bar width={row.changedSeconds / max} color={COLORS[0]} label={`${row.changedSeconds}`} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {row.effect?.kind === "percent" && row.effect.percent != null ? copy.effectOfChange(row.effect.percent) : null}
              {row.effect?.kind === "new" ? copy.newBottleneck : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoadBarsSingle({ record }: { record: SavedRecord }) {
  const { copy } = useI18n();
  const rows = record.summary.roads.slice(0, 8);
  const max = Math.max(...rows.map((road) => road.severeSeconds), 1);
  if (rows.length === 0) return <p className="mt-4 text-xs text-muted-foreground">{copy.noSevere}</p>;
  return (
    <section className="mt-4">
      <h3 className="text-xs font-medium text-muted-foreground">{copy.severeRoads}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((road) => (
          <li key={road.roadId}>
            <p className="flex justify-between gap-2 text-xs">
              <span className="truncate">{road.label}</span>
              <span className="text-muted-foreground">{copy.severeLine(road.severeSeconds, road.lowestSpeedKmh)}</span>
            </p>
            <Bar width={road.severeSeconds / max} color={COLORS[0]} label="" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bar({ width, color, label }: { width: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(1, width)) * 100}%`, background: color }} />
      </div>
      {label ? <span className="w-10 text-right text-[11px] text-muted-foreground">{label}</span> : null}
    </div>
  );
}
