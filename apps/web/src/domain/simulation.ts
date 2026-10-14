export type CongestionLevel = "free" | "moderate" | "heavy" | "severe";

/** Reserved for a future metric layer. The map must not paint these without segment speeds. */
export const CONGESTION_COLOR: Record<CongestionLevel, string> = {
  free: "#3dd68c",
  moderate: "#e6c04a",
  heavy: "#f08a3a",
  severe: "#ef4d4d",
};

export type SimulationSpeed = 1 | 2 | 5 | 10;

export type VehicleMode = "car" | "bus" | "truck" | "train";

export type LinkKind =
  | "road"
  | "highway"
  | "street"
  | "subway"
  | "railway"
  | "bridge"
  | "intersection"
  | "signal";

export type LinkEnd = {
  longitude: number;
  latitude: number;
  /** Another point on the same road, so a new link can join a road outside the simulated district. */
  along?: { longitude: number; latitude: number };
};

export type RoadEdit =
  | { wayId: number; op: "close"; coordinates?: LinkEnd[] }
  | { wayId: number; op: "lanes"; lanes: number; coordinates?: LinkEnd[] }
  | { wayId: number; op: "maxspeed"; maxspeedKmh: number; coordinates?: LinkEnd[] }
  | { wayId: number; op: "access"; modes: VehicleMode[]; coordinates?: LinkEnd[] }
  | { wayId: number; op: "park"; coordinates?: LinkEnd[] }
  | { wayId: number; op: "stall"; coordinates?: LinkEnd[] }
  | { wayId: number; op: "construction"; coordinates?: LinkEnd[] }
  | {
      wayId: number;
      op: "add";
      kind: LinkKind;
      name?: string;
      modes: VehicleMode[];
      start: LinkEnd;
      end: LinkEnd;
      /** Full geometry. Absent on links drawn before the canvas editor. */
      points?: LinkEnd[];
      lanes?: number;
      maxspeedKmh?: number;
      oneway?: boolean;
      /** Subway stops. A scenario note, not a traffic metric. */
      stops?: number;
    };

export type SimulationConfig = {
  scenarioId: string;
  startTime: string;
  endTime: string;
  demandIntensity: number;
  speed: SimulationSpeed;
  seed: number;
  edits?: RoadEdit[];
  /** Most trips end near OpenStreetMap offices and universities. */
  commuteAttractors?: boolean;
};

export type SegmentMetric = {
  roadId: number;
  speedKmh: number;
  congestion: CongestionLevel;
};

export type VehiclePosition = {
  id: string;
  longitude: number;
  latitude: number;
  bearing: number;
};

export type SimulationFrame = {
  timestamp: string;
  vehicles: VehiclePosition[];
  segments: SegmentMetric[];
};

export type SimulationTimeline = {
  runId: string;
  frames: SimulationFrame[];
};

export type RunStatus = "idle" | "running" | "ready" | "cancelled" | "error";

export type SimulationEvent =
  | { type: "progress"; runId: string; fraction: number; message: string }
  | { type: "metrics"; runId: string; timestamp: string; segments: SegmentMetric[] }
  | { type: "frame"; runId: string; timestamp: string; vehicles: VehiclePosition[]; segments: SegmentMetric[] }
  | { type: "finished"; runId: string }
  | { type: "cancelled"; runId: string }
  | { type: "error"; runId: string; message: string };

export type SimulationEngine = {
  start: (config: SimulationConfig) => Promise<{ runId: string }>;
  cancel: (runId: string) => Promise<void>;
  subscribe: (runId: string, listener: (event: SimulationEvent) => void) => () => void;
};

/** No engine until a worker answers. Do not replace this with fabricated results. */
export const simulationEngine: SimulationEngine | null = null;

const CONGESTION_LEVELS = new Set<CongestionLevel>(["free", "moderate", "heavy", "severe"]);

/** Above 80% free, above 50% moderate, above 25% heavy, otherwise severe. */
export function congestionFromRatio(speedKmh: number, limitKmh: number): CongestionLevel | null {
  if (!Number.isFinite(speedKmh) || !Number.isFinite(limitKmh) || speedKmh < 0 || limitKmh <= 0) {
    return null;
  }
  const ratio = speedKmh / limitKmh;
  if (ratio > 0.8) return "free";
  if (ratio > 0.5) return "moderate";
  if (ratio > 0.25) return "heavy";
  return "severe";
}

export function congestionColor(level: CongestionLevel | null | undefined): string | null {
  if (!level || !CONGESTION_LEVELS.has(level)) return null;
  return CONGESTION_COLOR[level];
}

/** Map a SUMO edge id to one OpenStreetMap way. Joined edges are omitted. */
export function osmWayIdFromEdge(edgeId: string, origId?: string | null): number | null {
  if (!edgeId || edgeId.startsWith(":")) return null;
  const raw = (origId ?? "").trim() || edgeId;
  if (/[\s,;]/.test(raw)) return null;
  const head = raw.split("#", 1)[0] ?? "";
  const numeric = head.startsWith("-") ? head.slice(1) : head;
  if (!/^\d+$/.test(numeric)) return null;
  return Number(numeric);
}

export function parseSimulationFrame(value: unknown): SimulationFrame | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.timestamp !== "string" || record.timestamp.length === 0) return null;
  if (!Array.isArray(record.vehicles) || !Array.isArray(record.segments)) return null;
  return {
    timestamp: record.timestamp,
    vehicles: record.vehicles.flatMap((item) => {
      const vehicle = parseVehicle(item);
      return vehicle ? [vehicle] : [];
    }),
    segments: record.segments.flatMap((item) => {
      const segment = parseSegment(item);
      return segment ? [segment] : [];
    }),
  };
}

export function parseSimulationTimeline(value: unknown): SimulationTimeline | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.runId !== "string" || !Array.isArray(record.frames)) return null;
  const frames: SimulationFrame[] = [];
  for (const item of record.frames) {
    const frame = parseSimulationFrame(item);
    if (!frame) return null;
    frames.push(frame);
  }
  return { runId: record.runId, frames };
}

export function parseSimulationEvent(value: unknown): SimulationEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.runId !== "string" || typeof record.type !== "string") return null;
  const runId = record.runId;
  if (record.type === "progress") {
    if (typeof record.fraction !== "number" || typeof record.message !== "string") return null;
    return { type: "progress", runId, fraction: record.fraction, message: record.message };
  }
  if (record.type === "finished" || record.type === "cancelled") {
    return { type: record.type, runId };
  }
  if (record.type === "error") {
    if (typeof record.message !== "string") return null;
    return { type: "error", runId, message: record.message };
  }
  if (record.type === "metrics") {
    if (typeof record.timestamp !== "string" || !Array.isArray(record.segments)) return null;
    const frame = parseSimulationFrame({ timestamp: record.timestamp, vehicles: [], segments: record.segments });
    return frame ? { type: "metrics", runId, timestamp: frame.timestamp, segments: frame.segments } : null;
  }
  if (record.type === "frame") {
    const frame = parseSimulationFrame(record);
    return frame
      ? { type: "frame", runId, timestamp: frame.timestamp, vehicles: frame.vehicles, segments: frame.segments }
      : null;
  }
  return null;
}

export function describeSimulation(status: {
  runStatus: RunStatus;
  timestamp?: string | null;
  progressMessage?: string | null;
}): string {
  if (status.runStatus === "running") return status.progressMessage || "Simulation running";
  if (status.runStatus === "ready" && status.timestamp) return status.timestamp;
  if (status.runStatus === "error") return "Simulation failed";
  if (status.runStatus === "cancelled") return "Simulation cancelled";
  return "No active simulation";
}

function parseVehicle(value: unknown): VehiclePosition | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const longitude = Number(record.longitude);
  const latitude = Number(record.latitude);
  const bearing = Number(record.bearing);
  if (typeof record.id !== "string" || !record.id) return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(bearing)) return null;
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  return { id: record.id, longitude, latitude, bearing };
}

function parseSegment(value: unknown): SegmentMetric | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const roadId = typeof record.roadId === "number" ? record.roadId : Number(record.roadId);
  const speedKmh = Number(record.speedKmh);
  const congestion = record.congestion;
  if (!Number.isInteger(roadId) || !Number.isFinite(speedKmh) || speedKmh < 0) return null;
  if (typeof congestion !== "string" || !CONGESTION_LEVELS.has(congestion as CongestionLevel)) return null;
  return { roadId, speedKmh, congestion: congestion as CongestionLevel };
}
