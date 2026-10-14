import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bottleneckSeries, rankSevereRoads, type BottleneckSample } from "@/domain/analytics";
import { compareSevereCounts, describeSevereDifference } from "@/domain/comparison";
import { MORNING_PEAK } from "@/domain/preset";
import { scenarioRunError, withRoadShape } from "@/domain/scenario";
import { bottleneckRoads, configFromInputs, simulationConfigError } from "@/domain/run-config";
import { SavedDashboard } from "@/features/simulation/SavedDashboard";
import { ScenarioCard } from "@/features/simulation/ScenarioCard";
import { cancelMorningPeak, compareMorningPeak, startMorningPeak } from "@/features/simulation/use-simulation";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const NAMED_BOTTLENECKS = 4;

export function SimulationPanel() {
  const { copy, show } = useI18n();
  const availability = useAppStore((state) => state.simulationAvailability);
  const runStatus = useAppStore((state) => state.runStatus);
  const progress = useAppStore((state) => state.progress);
  const progressMessage = useAppStore((state) => state.progressMessage);
  const runError = useAppStore((state) => state.runError);
  const frame = useAppStore((state) => (state.runStatus === "ready" ? state.frames[state.frameIndex] : undefined));
  const roads = useAppStore((state) => state.roads);
  const frames = useAppStore((state) => (state.runStatus === "ready" ? state.frames : EMPTY_FRAMES));
  const [startTime, setStartTime] = useState(MORNING_PEAK.config.startTime);
  const [endTime, setEndTime] = useState(MORNING_PEAK.config.endTime);
  const [vehicles, setVehicles] = useState(String(MORNING_PEAK.config.demandIntensity));
  const [seed, setSeed] = useState(String(MORNING_PEAK.config.seed));

  const connected = availability === "connected";
  const running = runStatus === "running";
  const edits = useAppStore((state) => state.edits);
  const commuteAttractors = useAppStore((state) => state.commuteAttractors);
  const comparison = useAppStore((state) => state.comparison);
  const inputError = simulationConfigError({
    startTime,
    endTime,
    demandIntensity: Number(vehicles),
    seed: Number(seed),
  });
  const scenarioError = scenarioRunError(edits);
  const roadNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const road of roads) {
      const label = road.name || road.nameEn;
      if (label) names.set(road.id, label);
    }
    return names;
  }, [roads]);
  const bottlenecks = useMemo(() => bottleneckRoads(frame?.segments ?? [], roadNames), [frame, roadNames]);
  const ranks = useMemo(() => rankSevereRoads(frames, roadNames), [frames, roadNames]);
  const series = useMemo(() => bottleneckSeries(frames), [frames]);
  const comparisonText = useMemo(
    () => (comparison ? describeSevereDifference(compareSevereCounts(comparison.baseline, comparison.scenario)) : null),
    [comparison],
  );
  const canCompare = edits.length > 0 || commuteAttractors;

  function currentConfig() {
    return configFromInputs({
      startTime,
      endTime,
      demandIntensity: Number(vehicles),
      seed: Number(seed),
      edits: withRoadShape(useAppStore.getState().edits, useAppStore.getState().roads),
      commuteAttractors: useAppStore.getState().commuteAttractors,
    });
  }

  function start() {
    if (inputError) return;
    void startMorningPeak(currentConfig());
  }

  function compare() {
    if (inputError || !canCompare) return;
    void compareMorningPeak(currentConfig());
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {copy.simulation}
      </h2>
      <div className="rounded-lg border border-border px-3 py-2.5">
        <p className="text-sm">{copy.morningPeak}</p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.cityName}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label={copy.start} value={startTime} disabled={running} onChange={setStartTime} />
          <Field label={copy.end} value={endTime} disabled={running} onChange={setEndTime} />
          <Field
            label={copy.vehicles}
            value={vehicles}
            disabled={running}
            onChange={setVehicles}
            inputMode="numeric"
          />
          <Field label={copy.seed} value={seed} disabled={running} onChange={setSeed} inputMode="numeric" />
        </div>
        {inputError ? <p className="mt-2 text-xs text-destructive">{show(inputError)}</p> : null}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.morningDetail}</p>
        <ScenarioCard startTime={startTime} endTime={endTime} />
      </div>

      {availability === "checking" ? (
        <p className="text-xs text-muted-foreground">{copy.checkingWorker}</p>
      ) : null}
      {availability === "unconfigured" ? (
        <p className="text-xs text-muted-foreground">{copy.unconfiguredWorker}</p>
      ) : null}
      {availability === "unreachable" ? (
        <p className="text-xs text-muted-foreground">{copy.unreachableWorker}</p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" disabled={!connected || running || inputError !== null || scenarioError !== null} onClick={start}>
          {copy.startRun}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!connected || running || inputError !== null || scenarioError !== null || !canCompare}
          onClick={compare}
        >
          {copy.compare}
        </Button>
        <Button size="sm" variant="outline" disabled={!running} onClick={() => void cancelMorningPeak()}>
          {copy.cancel}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.compareHelp}</p>

      {running ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{show(progressMessage)}</p>
        </div>
      ) : null}
      {runStatus === "error" && runError ? <p className="text-xs text-destructive">{show(runError)}</p> : null}
      {comparisonText ? <p className="text-xs leading-relaxed text-foreground">{show(comparisonText)}</p> : null}

      {frames.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.severeRoads}</h3>
          <BottleneckChart series={series} label={copy.severeChart} />
          {ranks.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {ranks.slice(0, 8).map((road) => (
                <li key={road.roadId} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-foreground">{road.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {copy.severeLine(road.severeSeconds, Number(road.lowestSpeedKmh.toFixed(0)))}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.noSevere}</p>
          )}
        </div>
      ) : null}

      <SavedDashboard
        config={currentConfig}
        frames={frames}
        baselineFrames={comparison?.baseline ?? null}
        names={roadNames}
        disabled={running}
      />

      {bottlenecks.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-foreground">
            {copy.bottleneckCount(bottlenecks.length)}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {bottlenecks.slice(0, NAMED_BOTTLENECKS).map((road) => (
              <li key={road.roadId} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{road.label}</span>
                <span className="shrink-0 text-muted-foreground">{show(`${road.speedKmh.toFixed(0)} km/h`)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const EMPTY_FRAMES: never[] = [];

function BottleneckChart({ series, label }: { series: BottleneckSample[]; label: string }) {
  if (series.length < 2) return null;
  const width = 240;
  const height = 48;
  const max = Math.max(...series.map((sample) => sample.count), 1);
  const step = width / (series.length - 1);
  const points = series
    .map((sample, index) => `${index * step},${height - (sample.count / max) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="h-12 w-full">
      <polyline fill="none" stroke="#ef4d4d" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function Field({
  label,
  value,
  disabled,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        aria-label={label}
        className="h-7 px-2 text-xs"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
