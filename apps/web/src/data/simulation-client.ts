import { parseSavedList, parseSavedRecord, type SavedListItem, type SavedRecord } from "@/domain/saved-result";
import {
  parseSimulationEvent,
  parseSimulationTimeline,
  type RoadEdit,
  type SimulationConfig,
  type SimulationEngine,
  type SimulationEvent,
  type SimulationTimeline,
} from "@/domain/simulation";

export type SimulationAvailability = "checking" | "unconfigured" | "unreachable" | "connected";

let connectedBase: string | null = null;

export function simulationBaseUrl(): string | null {
  const value = import.meta.env.VITE_SIMULATION_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function connectSimulationEngine(): Promise<{
  engine: SimulationEngine | null;
  availability: Exclude<SimulationAvailability, "checking">;
}> {
  const base = simulationBaseUrl();
  if (!base) return { engine: null, availability: "unconfigured" };
  try {
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return { engine: null, availability: "unreachable" };
    connectedBase = base;
    return { engine: createRemoteSimulationEngine(base), availability: "connected" };
  } catch {
    connectedBase = null;
    return { engine: null, availability: "unreachable" };
  }
}

export async function fetchActiveRun(): Promise<{
  runId: string;
  status: "running" | "ready" | "cancelled" | "error";
  fraction: number;
  message: string;
} | null> {
  if (!connectedBase) return null;
  const response = await fetch(`${connectedBase}/runs/active`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { runId?: unknown; status?: unknown; fraction?: unknown; message?: unknown };
  if (typeof payload.runId !== "string" || payload.runId.length === 0) return null;
  const status = payload.status;
  if (status !== "running" && status !== "ready" && status !== "cancelled" && status !== "error") return null;
  return {
    runId: payload.runId,
    status,
    fraction: typeof payload.fraction === "number" ? payload.fraction : 0,
    message: typeof payload.message === "string" ? payload.message : "",
  };
}

export async function fetchSimulationTimeline(runId: string): Promise<SimulationTimeline> {
  if (!connectedBase) throw new Error("Simulation worker is not connected.");
  const response = await fetch(`${connectedBase}/runs/${runId}/timeline`);
  if (!response.ok) throw new Error(`Could not read simulation results (${response.status}).`);
  const timeline = parseSimulationTimeline(await response.json());
  if (!timeline) throw new Error("The simulation result could not be read.");
  return timeline;
}

export async function listSavedResults(): Promise<SavedListItem[]> {
  const payload = await savedRequest("/saved");
  const list = parseSavedList(payload);
  if (!list) throw new Error("The saved results could not be read.");
  return list;
}

export async function fetchSavedResult(id: string): Promise<SavedRecord> {
  const record = parseSavedRecord(await savedRequest(`/saved/${id}`));
  if (!record) throw new Error("The saved result could not be read.");
  return record;
}

export async function createSavedResult(body: unknown): Promise<string> {
  const payload = await savedRequest("/saved", { method: "POST", body: JSON.stringify(body) });
  if (!payload || typeof payload !== "object" || typeof (payload as { id?: unknown }).id !== "string") {
    throw new Error("The result was not saved.");
  }
  return (payload as { id: string }).id;
}

export async function deleteSavedResult(id: string): Promise<void> {
  await savedRequest(`/saved/${id}`, { method: "DELETE" });
}

export type TemplateListItem = {
  id: string;
  name: string;
  editCount: number;
};

export async function listTemplates(): Promise<TemplateListItem[]> {
  const payload = await savedRequest("/templates");
  if (!Array.isArray(payload)) throw new Error("The templates could not be read.");
  return payload.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; name?: unknown; editCount?: unknown };
    if (typeof record.id !== "string" || typeof record.name !== "string" || !Number.isInteger(record.editCount)) return [];
    return [{ id: record.id, name: record.name, editCount: record.editCount as number }];
  });
}

export async function fetchTemplate(id: string): Promise<{ id: string; name: string; edits: RoadEdit[] }> {
  const payload = await savedRequest(`/templates/${id}`);
  if (!payload || typeof payload !== "object") throw new Error("The template could not be read.");
  const record = payload as { id?: unknown; name?: unknown; edits?: unknown };
  if (typeof record.id !== "string" || typeof record.name !== "string" || !Array.isArray(record.edits)) {
    throw new Error("The template could not be read.");
  }
  return { id: record.id, name: record.name, edits: record.edits as RoadEdit[] };
}

export async function createTemplate(name: string, edits: RoadEdit[]): Promise<string> {
  const payload = await savedRequest("/templates", { method: "POST", body: JSON.stringify({ name, edits }) });
  if (!payload || typeof payload !== "object" || typeof (payload as { id?: unknown }).id !== "string") {
    throw new Error("The template could not be saved.");
  }
  return (payload as { id: string }).id;
}

export async function updateTemplate(id: string, edits: RoadEdit[]): Promise<void> {
  await savedRequest(`/templates/${id}`, { method: "PUT", body: JSON.stringify({ edits }) });
}

export async function deleteTemplate(id: string): Promise<void> {
  await savedRequest(`/templates/${id}`, { method: "DELETE" });
}

async function savedRequest(path: string, init?: RequestInit): Promise<unknown> {
  if (!connectedBase) throw new Error("Simulation worker is not connected.");
  const response = await fetch(`${connectedBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new Error(typeof detail === "string" ? detail : "The saved results could not be read.");
  }
  if (response.status === 204) return null;
  return response.json();
}

function createRemoteSimulationEngine(base: string): SimulationEngine {
  return {
    async start(config: SimulationConfig) {
      const response = await fetch(`${base}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
        throw new Error(typeof detail === "string" ? detail : `Simulation failed (${response.status}).`);
      }
      const payload = (await response.json()) as { runId?: unknown };
      if (typeof payload.runId !== "string") throw new Error("Simulation did not return a run.");
      return { runId: payload.runId };
    },
    async cancel(runId: string) {
      const response = await fetch(`${base}/runs/${runId}/cancel`, { method: "POST" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Could not cancel the simulation (${response.status}).`);
      }
    },
    subscribe(runId: string, listener: (event: SimulationEvent) => void) {
      const socket = new WebSocket(socketUrl(base, runId));
      socket.addEventListener("message", (message) => {
        try {
          const event = parseSimulationEvent(JSON.parse(String(message.data)));
          if (event) listener(event);
        } catch {
          // Ignore a malformed socket message. The run status stays on the last valid event.
        }
      });
      return () => socket.close();
    },
  };
}

function socketUrl(base: string, runId: string): string {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/runs/${runId}/events`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
