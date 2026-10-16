import { describe, expect, it } from "vitest";
import { planResume, readComparisonSession, writeComparisonSession, type ComparisonSession } from "@/features/simulation/comparison-session";
import type { SimulationConfig } from "@/domain/simulation";

const config: SimulationConfig = {
  scenarioId: "ulaanbaatar-morning",
  startTime: "07:30",
  endTime: "07:45",
  demandIntensity: 2000,
  speed: 1,
  seed: 42,
  edits: [{ wayId: 11, op: "close" }],
  commuteAttractors: true,
};

function session(patch: Partial<ComparisonSession> = {}): ComparisonSession {
  return { config, baselineRunId: "aaa", scenarioRunId: null, ...patch };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("planResume", () => {
  it("reattaches a single running job when no comparison is saved", () => {
    expect(planResume({ runId: "one", status: "running", fraction: 0.4, message: "Simulating 07:31:00" }, null)).toEqual({
      kind: "single",
      runId: "one",
      fraction: 0.4,
      message: "Simulating 07:31:00",
    });
  });

  it("keeps going through the baseline half, then the scenario half", () => {
    const saved = session();
    expect(planResume({ runId: "aaa", status: "running", fraction: 0.2, message: "Building the city network" }, saved)).toMatchObject({
      kind: "baseline",
      fraction: 0.2,
    });
    expect(
      planResume({ runId: "bbb", status: "running", fraction: 0.7, message: "Simulating 07:40:00" }, session({ scenarioRunId: "bbb" })),
    ).toMatchObject({ kind: "scenario", fraction: 0.7 });
  });

  it("starts the scenario after the baseline has finished", () => {
    expect(planResume({ runId: "aaa", status: "ready", fraction: 1, message: "" }, session())).toMatchObject({
      kind: "scenario-next",
    });
    expect(planResume(null, session())).toMatchObject({ kind: "scenario-next" });
  });

  it("does not treat a different running job as this comparison", () => {
    expect(planResume({ runId: "other", status: "running", fraction: 0.1, message: "" }, session())).toMatchObject({
      kind: "single",
      runId: "other",
    });
  });

  it("ignores a finished run", () => {
    expect(planResume({ runId: "one", status: "ready", fraction: 1, message: "" }, null)).toEqual({ kind: "idle" });
  });
});

describe("comparison session storage", () => {
  it("round-trips the config and run ids", () => {
    const storage = memoryStorage();
    writeComparisonSession(session({ scenarioRunId: "bbb" }), storage);
    expect(readComparisonSession(storage)).toEqual(session({ scenarioRunId: "bbb" }));
  });
});
