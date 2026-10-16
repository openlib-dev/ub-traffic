import type { RoadEdit, SimulationConfig, SimulationSpeed } from "@/domain/simulation";

const KEY = "ub-comparison";

export type ComparisonSession = {
  config: SimulationConfig;
  baselineRunId: string | null;
  scenarioRunId: string | null;
};

export type ActiveSnapshot = {
  runId: string;
  status: "running" | "ready" | "cancelled" | "error";
  fraction: number;
  message: string;
};

export type ResumePlan =
  | { kind: "single"; runId: string; fraction: number; message: string }
  | { kind: "baseline"; session: ComparisonSession; fraction: number; message: string }
  | { kind: "scenario"; session: ComparisonSession; fraction: number; message: string }
  | { kind: "scenario-next"; session: ComparisonSession }
  | { kind: "idle" };

export function readComparisonSession(storage: Pick<Storage, "getItem"> | null = browserStorage()): ComparisonSession | null {
  if (!storage) return null;
  try {
    return parseComparisonSession(JSON.parse(storage.getItem(KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function writeComparisonSession(
  session: ComparisonSession,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): void {
  storage?.setItem(KEY, JSON.stringify(session));
}

export function clearComparisonSession(storage: Pick<Storage, "removeItem"> | null = browserStorage()): void {
  storage?.removeItem(KEY);
}

/** What a refreshed page should do with the worker's current run and a saved comparison. */
export function planResume(active: ActiveSnapshot | null, session: ComparisonSession | null): ResumePlan {
  if (session && active?.status === "running" && session.scenarioRunId && active.runId === session.scenarioRunId) {
    return { kind: "scenario", session, fraction: active.fraction, message: active.message };
  }
  if (
    session &&
    active?.status === "running" &&
    (active.runId === session.baselineRunId || (session.baselineRunId === null && session.scenarioRunId === null))
  ) {
    return {
      kind: "baseline",
      session: { ...session, baselineRunId: active.runId },
      fraction: active.fraction,
      message: active.message,
    };
  }
  if (
    session?.baselineRunId &&
    session.scenarioRunId === null &&
    (active === null || (active.runId === session.baselineRunId && active.status === "ready"))
  ) {
    return { kind: "scenario-next", session };
  }
  if (active?.status === "running") {
    return { kind: "single", runId: active.runId, fraction: active.fraction, message: active.message };
  }
  return { kind: "idle" };
}

function browserStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function parseComparisonSession(value: unknown): ComparisonSession | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { config?: unknown; baselineRunId?: unknown; scenarioRunId?: unknown };
  const config = parseConfig(record.config);
  if (!config) return null;
  return {
    config,
    baselineRunId: runId(record.baselineRunId),
    scenarioRunId: runId(record.scenarioRunId),
  };
}

function runId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseConfig(value: unknown): SimulationConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<SimulationConfig>;
  const speed = record.speed;
  if (typeof record.scenarioId !== "string" || record.scenarioId.length === 0) return null;
  if (typeof record.startTime !== "string" || typeof record.endTime !== "string") return null;
  if (!Number.isInteger(record.demandIntensity) || !Number.isInteger(record.seed)) return null;
  if (speed !== 1 && speed !== 2 && speed !== 5 && speed !== 10) return null;
  if (record.edits !== undefined && !Array.isArray(record.edits)) return null;
  return {
    scenarioId: record.scenarioId,
    startTime: record.startTime,
    endTime: record.endTime,
    demandIntensity: record.demandIntensity as number,
    speed: speed as SimulationSpeed,
    seed: record.seed as number,
    edits: (record.edits as RoadEdit[] | undefined) ?? [],
    commuteAttractors: record.commuteAttractors !== false,
  };
}
