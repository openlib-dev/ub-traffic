import { Button } from "@/components/ui/button";
import type { SimulationSpeed } from "@/domain/simulation";
import { usePlaybackClock } from "@/features/simulation/use-simulation";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const SPEEDS: SimulationSpeed[] = [1, 2, 5, 10];

export function PlaybackBar() {
  usePlaybackClock();
  const { copy } = useI18n();
  const frames = useAppStore((state) => state.frames);
  const frameIndex = useAppStore((state) => state.frameIndex);
  const playing = useAppStore((state) => state.playing);
  const playbackSpeed = useAppStore((state) => state.playbackSpeed);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const setPlaybackSpeed = useAppStore((state) => state.setPlaybackSpeed);
  const setFrameIndex = useAppStore((state) => state.setFrameIndex);
  const clearPlayback = useAppStore((state) => state.clearPlayback);
  const comparison = useAppStore((state) => state.comparison);
  const showComparison = useAppStore((state) => state.showComparison);

  if (frames.length === 0) return null;
  const timestamp = frames[frameIndex]?.timestamp ?? "";

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Button size="xs" variant="outline" onClick={() => setPlaying(!playing)}>
        {playing ? copy.pause : copy.play}
      </Button>
      {SPEEDS.map((speed) => (
        <Button
          key={speed}
          size="xs"
          variant={playbackSpeed === speed ? "secondary" : "ghost"}
          aria-pressed={playbackSpeed === speed}
          onClick={() => setPlaybackSpeed(speed)}
        >
          {speed}x
        </Button>
      ))}
      {comparison ? (
        <>
          <Button
            size="xs"
            variant={comparison.side === "baseline" ? "secondary" : "ghost"}
            aria-pressed={comparison.side === "baseline"}
            onClick={() => showComparison("baseline")}
          >
            {copy.baseline}
          </Button>
          <Button
            size="xs"
            variant={comparison.side === "scenario" ? "secondary" : "ghost"}
            aria-pressed={comparison.side === "scenario"}
            onClick={() => showComparison("scenario")}
          >
            {copy.scenarioSide}
          </Button>
        </>
      ) : null}
      <span className="w-16 shrink-0 text-xs tabular-nums text-foreground">{timestamp}</span>
      <input
        aria-label={copy.simulationTime}
        type="range"
        min={0}
        max={Math.max(frames.length - 1, 0)}
        value={frameIndex}
        onChange={(event) => setFrameIndex(Number(event.target.value))}
        className="min-w-0 flex-1 accent-primary"
      />
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{copy.estimatedDemand}</span>
      <Button size="xs" variant="ghost" onClick={clearPlayback}>
        {copy.clear}
      </Button>
    </div>
  );
}
