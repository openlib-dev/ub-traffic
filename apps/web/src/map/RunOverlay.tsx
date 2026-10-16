import { Button } from "@/components/ui/button";
import { cancelMorningPeak } from "@/features/simulation/use-simulation";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

/** Dims the map while SUMO is running and keeps cancel on the map. */
export function RunOverlay() {
  const { copy, show } = useI18n();
  const running = useAppStore((state) => state.runStatus === "running");
  const progress = useAppStore((state) => state.progress);
  const progressMessage = useAppStore((state) => state.progressMessage);
  if (!running) return null;
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55" role="status" aria-live="polite">
      <div className="flex w-[min(22rem,calc(100%-2rem))] flex-col gap-3 rounded-lg border border-white/10 bg-black px-5 py-4 text-white shadow-lg">
        <p className="text-sm leading-relaxed">{show(progressMessage || "Simulation running")}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-white" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs tabular-nums text-white/70">{percent}%</p>
        <Button size="sm" variant="outline" className="self-start border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => void cancelMorningPeak()}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}
