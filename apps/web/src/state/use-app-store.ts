import { create } from "zustand";
import { ULAANBAATAR } from "@/domain/city";
import {
  laneChain,
  mergeRoads,
  oppositeOneway,
  pruneRoads,
  type BBox,
  type LayerToggles,
  type LngLat,
  type RoadFeature,
} from "@/domain/road";
import type { SavedRecord } from "@/domain/saved-result";
import type { RoadTemplate } from "@/domain/template";
import type { RoadEdit, RunStatus, SimulationEngine, SimulationFrame, SimulationSpeed } from "@/domain/simulation";
import { loadLocalRoads, localRoadsReady, roadsForLane } from "@/data/local-roads";
import { updateTemplate, type SimulationAvailability } from "@/data/simulation-client";
import { rememberEdits, redoEdits, undoEdits, type DrawTool } from "@/domain/editor";
import type { Locale } from "@/i18n/catalog";

export type BasemapId = "dark" | "light" | "satellite";

export type Camera = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type FlyTarget = {
  id: number;
  label: string;
  longitude: number;
  latitude: number;
  zoom: number;
  bbox?: BBox;
};

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type ComparisonSide = "baseline" | "scenario";

export type Comparison = {
  baseline: SimulationFrame[];
  scenario: SimulationFrame[];
  side: ComparisonSide;
};

type AppState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  cityLabel: string;
  camera: Camera;
  viewBBox: BBox | null;
  viewToken: number;
  flyTarget: FlyTarget | null;
  basemap: BasemapId;
  layers: LayerToggles;
  roads: RoadFeature[];
  selectedRoadId: number | null;
  selectedRoadIds: number[];
  loadStatus: LoadStatus;
  loadError: string | null;
  retryToken: number;
  simulationAvailability: SimulationAvailability;
  engine: SimulationEngine | null;
  runId: string | null;
  runStatus: RunStatus;
  progress: number;
  progressMessage: string | null;
  runError: string | null;
  frames: SimulationFrame[];
  frameIndex: number;
  playing: boolean;
  playbackSpeed: SimulationSpeed;
  comparison: Comparison | null;
  savePrompt: boolean;
  dashboardReference: SavedRecord | null;
  dashboardChanged: SavedRecord | null;
  dashboardChartPair: readonly [SavedRecord, SavedRecord] | null;
  mapTemplates: RoadTemplate[];
  templateBase: boolean;
  setDashboardSelection: (reference: SavedRecord | null, changed: SavedRecord | null) => void;
  setDashboardChartPair: (pair: readonly [SavedRecord, SavedRecord] | null) => void;
  setMapTemplates: (templates: RoadTemplate[]) => void;
  openTemplate: (template: RoadTemplate) => void;
  showBaseMap: () => void;
  edits: RoadEdit[];
  commuteAttractors: boolean;
  editorTool: DrawTool;
  draftPoints: LngLat[];
  draftCursor: LngLat | null;
  draftInvalid: boolean;
  draftSnapped: boolean;
  selectedEditIds: number[];
  editPast: RoadEdit[][];
  editFuture: RoadEdit[][];
  drawError: string | null;
  setView: (camera: Camera, bbox: BBox) => void;
  flyTo: (target: Omit<FlyTarget, "id">) => void;
  setBasemap: (basemap: BasemapId) => void;
  setLayer: (key: keyof LayerToggles, enabled: boolean) => void;
  ingestRoads: (incoming: RoadFeature[], view: BBox) => void;
  selectRoad: (id: number | null, addOpposite?: boolean) => void;
  setLoadStatus: (status: LoadStatus, error?: string | null) => void;
  retryLoad: () => void;
  setSimulationConnection: (engine: SimulationEngine | null, availability: SimulationAvailability) => void;
  beginRun: () => void;
  setRunId: (runId: string) => void;
  updateProgress: (fraction: number, message: string) => void;
  finishRun: (frames: SimulationFrame[]) => void;
  finishComparison: (baseline: SimulationFrame[], scenario: SimulationFrame[]) => void;
  showComparison: (side: ComparisonSide) => void;
  failRun: (message: string) => void;
  markCancelled: () => void;
  setFrameIndex: (frameIndex: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (playbackSpeed: SimulationSpeed) => void;
  clearPlayback: () => void;
  dismissSavePrompt: () => void;
  setEdits: (edits: RoadEdit[]) => void;
  setCommuteAttractors: (commuteAttractors: boolean) => void;
  setEditorTool: (editorTool: DrawTool) => void;
  setDraft: (draftPoints: LngLat[], draftCursor: LngLat | null, draftInvalid: boolean, draftSnapped: boolean) => void;
  cancelDraft: () => void;
  setSelectedEdits: (selectedEditIds: number[]) => void;
  undoEdit: () => void;
  redoEdit: () => void;
  setDrawError: (drawError: string | null) => void;
};

const initialCamera: Camera = {
  longitude: ULAANBAATAR.longitude,
  latitude: ULAANBAATAR.latitude,
  zoom: ULAANBAATAR.zoom,
  pitch: 0,
  bearing: 0,
};

function storedLocale(): Locale {
  try {
    const value = localStorage.getItem("ub-locale");
    if (value === "mn" || value === "en") return value;
  } catch {
    /* private mode */
  }
  return "mn";
}

export const useAppStore = create<AppState>((set, get) => ({
  locale: storedLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem("ub-locale", locale);
    } catch {
      /* private mode */
    }
    set({ locale });
  },
  cityLabel: ULAANBAATAR.label,
  camera: initialCamera,
  viewBBox: null,
  viewToken: 0,
  flyTarget: null,
  basemap: "light",
  layers: { arterials: true, local: true, service: false },
  roads: [],
  selectedRoadId: null,
  selectedRoadIds: [],
  loadStatus: "idle",
  loadError: null,
  retryToken: 0,
  simulationAvailability: "checking",
  engine: null,
  runId: null,
  runStatus: "idle",
  progress: 0,
  progressMessage: null,
  runError: null,
  frames: [],
  frameIndex: 0,
  playing: false,
  playbackSpeed: 1,
  comparison: null,
  savePrompt: false,
  dashboardReference: null,
  dashboardChanged: null,
  dashboardChartPair: null,
  mapTemplates: [],
  templateBase: true,
  edits: [],
  commuteAttractors: true,
  editorTool: "select",
  draftPoints: [],
  draftCursor: null,
  draftInvalid: false,
  draftSnapped: false,
  selectedEditIds: [],
  editPast: [],
  editFuture: [],
  drawError: null,
  setView: (camera, bbox) =>
    set((state) => ({
      camera,
      viewBBox: bbox,
      viewToken: state.viewToken + 1,
    })),
  flyTo: (target) =>
    set((state) => ({
      cityLabel: target.label,
      flyTarget: { ...target, id: (state.flyTarget?.id ?? 0) + 1 },
    })),
  setBasemap: (basemap) => set({ basemap }),
  setLayer: (key, enabled) =>
    set((state) => ({
      layers: { ...state.layers, [key]: enabled },
    })),
  ingestRoads: (incoming, view) =>
    set((state) => {
      const roads = pruneRoads(mergeRoads(state.roads, incoming), view);
      return { roads, loadStatus: "ready", loadError: null };
    }),
  selectRoad: (id, addOpposite = false) => {
    const ready = localRoadsReady();
    set((state) => laneSelection(state.roads, state.selectedRoadIds, id, addOpposite));
    if (ready || id == null) return;
    void loadLocalRoads().then(() => {
      if (get().selectedRoadId !== id) return;
      set((state) => laneSelection(state.roads, state.selectedRoadIds, id, addOpposite));
    });
  },
  setLoadStatus: (loadStatus, loadError = null) => set({ loadStatus, loadError }),
  retryLoad: () => set((state) => ({ retryToken: state.retryToken + 1, loadError: null })),
  setSimulationConnection: (engine, simulationAvailability) => set({ engine, simulationAvailability }),
  beginRun: () =>
    set({
      runId: null,
      runStatus: "running",
      progress: 0,
      progressMessage: "Starting simulation",
      runError: null,
      frames: [],
      frameIndex: 0,
      playing: false,
      comparison: null,
      savePrompt: false,
    }),
  setRunId: (runId) => set({ runId }),
  updateProgress: (progress, progressMessage) => set({ progress, progressMessage, runStatus: "running" }),
  finishRun: (frames) =>
    set({
      runStatus: "ready",
      progress: 1,
      progressMessage: null,
      frames,
      frameIndex: 0,
      playing: false,
      comparison: null,
      savePrompt: frames.length > 0,
    }),
  finishComparison: (baseline, scenario) =>
    set({
      runStatus: "ready",
      progress: 1,
      progressMessage: null,
      frames: scenario,
      frameIndex: 0,
      playing: false,
      comparison: { baseline, scenario, side: "scenario" },
      savePrompt: scenario.length > 0,
    }),
  setDashboardSelection: (dashboardReference, dashboardChanged) => set({ dashboardReference, dashboardChanged }),
  setDashboardChartPair: (dashboardChartPair) => set({ dashboardChartPair }),
  setMapTemplates: (mapTemplates) => {
    const next = mapTemplates.slice(0, 2);
    set({ mapTemplates: next, templateBase: next.length === 0 });
  },
  openTemplate: (template) =>
    set({
      templateBase: false,
      mapTemplates: [template],
      edits: template.edits,
      editPast: [],
      editFuture: [],
      selectedEditIds: [],
      editorTool: "select",
      draftPoints: [],
      draftCursor: null,
      draftInvalid: false,
      draftSnapped: false,
      drawError: null,
    }),
  showBaseMap: () =>
    set({
      templateBase: true,
      mapTemplates: [],
      edits: [],
      editPast: [],
      editFuture: [],
      selectedEditIds: [],
      editorTool: "select",
      draftPoints: [],
      draftCursor: null,
      draftInvalid: false,
      draftSnapped: false,
      drawError: null,
    }),
  showComparison: (side) =>
    set((state) => {
      if (!state.comparison) return {};
      const frames = state.comparison[side];
      const timestamp = state.frames[state.frameIndex]?.timestamp;
      const nextIndex = frames.findIndex((frame) => frame.timestamp === timestamp);
      return {
        frames,
        frameIndex: nextIndex >= 0 ? nextIndex : 0,
        playing: false,
        comparison: { ...state.comparison, side },
      };
    }),
  failRun: (runError) =>
    set({
      runStatus: "error",
      runError,
      playing: false,
      frames: [],
      frameIndex: 0,
    }),
  markCancelled: () =>
    set({
      runStatus: "cancelled",
      playing: false,
      frames: [],
      frameIndex: 0,
      progressMessage: null,
    }),
  setFrameIndex: (frameIndex) =>
    set((state) => ({
      frameIndex: Math.min(Math.max(0, frameIndex), Math.max(state.frames.length - 1, 0)),
    })),
  setPlaying: (playing) => set({ playing }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  clearPlayback: () =>
    set({
      runId: null,
      runStatus: "idle",
      progress: 0,
      progressMessage: null,
      runError: null,
      frames: [],
      frameIndex: 0,
      playing: false,
      comparison: null,
      savePrompt: false,
    }),
  dismissSavePrompt: () => set({ savePrompt: false }),
  setEdits: (edits) =>
    set((state) => {
      const active = editableTemplate(state);
      if (!active) return {};
      const remembered = rememberEdits(state.editPast, state.edits, edits);
      if (!remembered) return {};
      persistTemplate(active, remembered.present);
      return {
        edits: remembered.present,
        editPast: remembered.past,
        editFuture: remembered.future,
        mapTemplates: [{ ...active, edits: remembered.present }],
      };
    }),
  setCommuteAttractors: (commuteAttractors) => set({ commuteAttractors }),
  setEditorTool: (editorTool) =>
    set({ editorTool, draftPoints: [], draftCursor: null, draftInvalid: false, draftSnapped: false, drawError: null }),
  setDraft: (draftPoints, draftCursor, draftInvalid, draftSnapped) =>
    set({ draftPoints, draftCursor, draftInvalid, draftSnapped }),
  cancelDraft: () => set({ draftPoints: [], draftCursor: null, draftInvalid: false, draftSnapped: false, drawError: null }),
  setSelectedEdits: (selectedEditIds) =>
    set({ selectedEditIds, ...(selectedEditIds.length > 0 ? { selectedRoadId: null, selectedRoadIds: [] } : {}) }),
  undoEdit: () =>
    set((state) => {
      const active = editableTemplate(state);
      if (!active) return {};
      const undone = undoEdits(state.editPast, state.edits, state.editFuture);
      if (!undone) return {};
      persistTemplate(active, undone.present);
      return {
        edits: undone.present,
        editPast: undone.past,
        editFuture: undone.future,
        selectedEditIds: [],
        mapTemplates: [{ ...active, edits: undone.present }],
      };
    }),
  redoEdit: () =>
    set((state) => {
      const active = editableTemplate(state);
      if (!active) return {};
      const redone = redoEdits(state.editPast, state.edits, state.editFuture);
      if (!redone) return {};
      persistTemplate(active, redone.present);
      return {
        edits: redone.present,
        editPast: redone.past,
        editFuture: redone.future,
        selectedEditIds: [],
        mapTemplates: [{ ...active, edits: redone.present }],
      };
    }),
  setDrawError: (drawError) => set({ drawError }),
}));

function laneSelection(
  loaded: readonly RoadFeature[],
  current: readonly number[],
  id: number | null,
  addOpposite: boolean,
) {
  if (id == null) return { selectedRoadId: null, selectedRoadIds: [] as number[] };
  const pool = roadsForLane(loaded);
  const chain = laneChain(pool, id);
  const opposite = oppositeOneway(pool.find((road) => road.id === id)?.oneway ?? "unknown");
  const added = addOpposite && opposite ? laneChain(pool, id, opposite) : [];
  const selectedRoadIds = addOpposite ? [...new Set([...current, ...chain, ...added])] : chain;
  return { selectedRoadId: id, selectedRoadIds, selectedEditIds: [] as number[] };
}

function editableTemplate(state: { templateBase: boolean; mapTemplates: RoadTemplate[] }): RoadTemplate | null {
  if (state.templateBase || state.mapTemplates.length !== 1) return null;
  const active = state.mapTemplates[0];
  return active?.key.startsWith("template:") ? active : null;
}

function persistTemplate(active: RoadTemplate, edits: RoadEdit[]) {
  void updateTemplate(active.key.slice("template:".length), edits).catch(() => undefined);
}
