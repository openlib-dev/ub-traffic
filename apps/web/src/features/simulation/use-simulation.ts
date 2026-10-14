import { useEffect } from "react";
import { connectSimulationEngine, fetchActiveRun, fetchSimulationTimeline } from "@/data/simulation-client";
import { ULAANBAATAR } from "@/domain/city";
import { MORNING_PEAK } from "@/domain/preset";
import type { SimulationConfig, SimulationEvent, SimulationFrame } from "@/domain/simulation";
import { useAppStore } from "@/state/use-app-store";

let unsubscribe: (() => void) | null = null;
let cancelRequested = false;

class RunCancelled extends Error {
  constructor() {
    super("Simulation cancelled");
    this.name = "RunCancelled";
  }
}

export function useSimulation() {
  const setSimulationConnection = useAppStore((state) => state.setSimulationConnection);

  useEffect(() => {
    let cancelled = false;
    void connectSimulationEngine().then(async (result) => {
      if (cancelled) return;
      setSimulationConnection(result.engine, result.availability);
      if (!result.engine) return;
      const active = await fetchActiveRun().catch(() => null);
      if (cancelled || !active || useAppStore.getState().runStatus === "running") return;
      resumeActiveRun(active);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [setSimulationConnection]);
}

export function usePlaybackClock() {
  const playing = useAppStore((state) => state.playing);
  const playbackSpeed = useAppStore((state) => state.playbackSpeed);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const state = useAppStore.getState();
      if (state.frameIndex >= state.frames.length - 1) {
        state.setPlaying(false);
        return;
      }
      state.setFrameIndex(state.frameIndex + 1);
    }, 1000 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [playbackSpeed, playing]);
}

function resumeActiveRun(active: {
  runId: string;
  status: "running" | "ready" | "cancelled" | "error";
  fraction: number;
  message: string;
}) {
  const { engine } = useAppStore.getState();
  if (!engine || active.status !== "running") return;
  useAppStore.getState().beginRun();
  useAppStore.getState().setRunId(active.runId);
  useAppStore.getState().updateProgress(active.fraction, active.message || "Simulation running");
  unsubscribe?.();
  unsubscribe = engine.subscribe(active.runId, (event) =>
    onRunEvent(
      active.runId,
      event,
      (fraction, message) => useAppStore.getState().updateProgress(fraction, message),
      (frames) => {
        if (useAppStore.getState().runStatus === "running" && useAppStore.getState().runId === active.runId) {
          useAppStore.getState().finishRun(frames);
        }
      },
      (error) => {
        if (useAppStore.getState().runId !== active.runId) return;
        settleRunError(error);
      },
    ),
  );
}

export async function startMorningPeak(config: SimulationConfig) {
  const { engine, runStatus } = useAppStore.getState();
  if (!engine || runStatus === "running") return;
  cancelRequested = false;
  focusCity();
  useAppStore.getState().beginRun();
  try {
    const frames = await runToFrames(config, (fraction, message) => {
      useAppStore.getState().updateProgress(fraction, message);
    });
    if (useAppStore.getState().runStatus !== "running") return;
    useAppStore.getState().finishRun(frames);
  } catch (error) {
    settleRunError(error);
  }
}

export async function compareMorningPeak(config: SimulationConfig) {
  const { engine, runStatus } = useAppStore.getState();
  if (!engine || runStatus === "running") return;
  if ((config.edits?.length ?? 0) === 0 && !config.commuteAttractors) return;
  cancelRequested = false;
  focusCity();
  useAppStore.getState().beginRun();
  try {
    const baseline = await runToFrames(
      { ...config, edits: [], commuteAttractors: false },
      (fraction, message) => useAppStore.getState().updateProgress(fraction * 0.5, `Baseline: ${message}`),
    );
    if (useAppStore.getState().runStatus !== "running") return;
    const scenario = await runToFrames(config, (fraction, message) => {
      useAppStore.getState().updateProgress(0.5 + fraction * 0.5, `Scenario: ${message}`);
    });
    if (useAppStore.getState().runStatus !== "running") return;
    useAppStore.getState().finishComparison(baseline, scenario);
  } catch (error) {
    settleRunError(error);
  }
}

export async function cancelMorningPeak() {
  const { engine, runId, runStatus } = useAppStore.getState();
  if (!engine || runStatus !== "running") return;
  if (!runId) {
    cancelRequested = true;
    return;
  }
  try {
    await engine.cancel(runId);
  } catch (error) {
    useAppStore.getState().failRun(error instanceof Error ? error.message : "Could not cancel the simulation.");
  }
}

function focusCity() {
  const district = MORNING_PEAK.district;
  useAppStore.getState().flyTo({
    label: ULAANBAATAR.label,
    longitude: (district.west + district.east) / 2,
    latitude: (district.south + district.north) / 2,
    zoom: 15,
    bbox: district,
  });
}

function settleRunError(error: unknown) {
  if (useAppStore.getState().runStatus !== "running") return;
  if (error instanceof RunCancelled) {
    useAppStore.getState().markCancelled();
    return;
  }
  useAppStore.getState().failRun(error instanceof Error ? error.message : "Simulation failed.");
}

function runToFrames(
  config: SimulationConfig,
  onProgress: (fraction: number, message: string) => void,
): Promise<SimulationFrame[]> {
  const { engine } = useAppStore.getState();
  if (!engine) return Promise.reject(new Error("Simulation worker is not running."));
  return new Promise((resolve, reject) => {
    void engine
      .start(config)
      .then(async ({ runId }) => {
        if (useAppStore.getState().runStatus !== "running") {
          await engine.cancel(runId);
          reject(new RunCancelled());
          return;
        }
        useAppStore.getState().setRunId(runId);
        unsubscribe?.();
        unsubscribe = engine.subscribe(runId, (event) => onRunEvent(runId, event, onProgress, resolve, reject));
        if (cancelRequested) await engine.cancel(runId);
      })
      .catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error("Simulation failed."));
      });
  });
}

function onRunEvent(
  runId: string,
  event: SimulationEvent,
  onProgress: (fraction: number, message: string) => void,
  resolve: (frames: SimulationFrame[]) => void,
  reject: (error: Error) => void,
) {
  if (event.runId !== runId || useAppStore.getState().runId !== runId) return;
  if (event.type === "progress") {
    onProgress(event.fraction, event.message);
    return;
  }
  if (event.type === "finished") {
    unsubscribe?.();
    unsubscribe = null;
    void fetchSimulationTimeline(runId)
      .then((timeline) => {
        if (useAppStore.getState().runId !== runId) {
          reject(new RunCancelled());
          return;
        }
        resolve(timeline.frames);
      })
      .catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error("Simulation failed."));
      });
    return;
  }
  if (event.type === "error") {
    unsubscribe?.();
    unsubscribe = null;
    reject(new Error(event.message));
    return;
  }
  if (event.type === "cancelled") {
    unsubscribe?.();
    unsubscribe = null;
    reject(new RunCancelled());
  }
}
