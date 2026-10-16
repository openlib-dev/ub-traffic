import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FeatureCollection, Geometry } from "geojson";
import { setWorkerUrl, type Map as MaplibreMap, type StyleSpecification } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(maplibreWorkerUrl);
import { Button } from "@/components/ui/button";
import { loadBasemap, roadInsertBeforeId } from "@/map/basemap";
import {
  roadCasingPaint,
  roadHitPaint,
  roadLineLayout,
  roadLinePaint,
  bottleneckLinePaint,
  severeDeltaPaint,
  severeSecondsPaint,
  roadSelectionPaint,
  scenarioClosedPaint,
  scenarioBridgeCasingPaint,
  scenarioLinkPaint,
  scenarioOutlinePaint,
  scenarioPreviewPaint,
  scenarioRailwayPaint,
} from "@/map/road-style";
import { roadIdFromFeature, toRoadCollection } from "@/map/roads-geojson";
import { EMPTY_VEHICLES, toVehicleCollection } from "@/map/vehicles-geojson";
import { useRoadLoader } from "@/map/use-road-loader";
import { severeSecondsByRoad } from "@/domain/analytics";
import { severeDelta } from "@/domain/saved-result";
import { classifyTemplates } from "@/domain/template";
import { ULAANBAATAR } from "@/domain/city";
import { commitDrawnPath, isDrawTool, removeEdits, reshapeDrawn, snapDrawPoint, toolKind, type DrawTool, type LngLat } from "@/domain/editor";
import { SNAP_METERS } from "@/domain/scenario";
import type { CongestionLevel, RoadEdit, SimulationFrame } from "@/domain/simulation";
import { useI18n } from "@/i18n/use-i18n";
import { EditorToolbar } from "@/map/EditorToolbar";
import { RunOverlay } from "@/map/RunOverlay";
import { TemplatePanel } from "@/map/TemplatePanel";
import { useAppStore } from "@/state/use-app-store";

const EMPTY_FRAMES: SimulationFrame[] = [];

export function MapView() {
  useRoadLoader();
  const { copy, show } = useI18n();
  const mapRef = useRef<MapRef>(null);
  const basemap = useAppStore((state) => state.basemap);
  const flyTarget = useAppStore((state) => state.flyTarget);
  const roads = useAppStore((state) => state.roads);
  const layers = useAppStore((state) => state.layers);
  const zoom = useAppStore((state) => state.camera.zoom);
  const selectedRoadIds = useAppStore((state) => state.selectedRoadIds);
  const loadStatus = useAppStore((state) => state.loadStatus);
  const loadError = useAppStore((state) => state.loadError);
  const retryLoad = useAppStore((state) => state.retryLoad);
  const selectRoad = useAppStore((state) => state.selectRoad);
  const frame = useAppStore((state) => (state.runStatus === "ready" ? state.frames[state.frameIndex] : undefined));
  const readyFrames = useAppStore((state) => (state.runStatus === "ready" ? state.frames : EMPTY_FRAMES));
  const edits = useAppStore((state) => state.edits);
  const editorTool = useAppStore((state) => state.editorTool);
  const draftPoints = useAppStore((state) => state.draftPoints);
  const draftCursor = useAppStore((state) => state.draftCursor);
  const draftInvalid = useAppStore((state) => state.draftInvalid);
  const draftSnapped = useAppStore((state) => state.draftSnapped);
  const selectedEditIds = useAppStore((state) => state.selectedEditIds);
  const drawError = useAppStore((state) => state.drawError);
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [styleAttempt, setStyleAttempt] = useState(0);
  const [labelBeforeId, setLabelBeforeId] = useState<string | undefined>();
  const [dragLine, setDragLine] = useState<LngLat[] | null>(null);
  const gesture = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const openWay = useRef<number | null>(null);
  const space = useRef(false);
  const handled = useRef(false);
  const handleDrag = useRef<{ wayId: number; index: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const drawing = isDrawTool(editorTool);
    if (drawing && !space.current) map.dragPan.disable();
    else map.dragPan.enable();
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [editorTool, style]);

  useEffect(() => {
    function typingTarget(event: KeyboardEvent) {
      const target = event.target;
      return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    }
    function onKey(event: KeyboardEvent) {
      if (typingTarget(event)) return;
      const store = useAppStore.getState();
      if (!editingTemplate(store) && event.key !== "Escape" && event.key !== " ") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redoEdit();
        else store.undoEdit();
        return;
      }
      if (event.key === "Escape") {
        openWay.current = null;
        store.cancelDraft();
        setDragLine(null);
        return;
      }
      if (event.key === "Enter") {
        openWay.current = null;
        store.cancelDraft();
        setDragLine(null);
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && store.selectedEditIds.length > 0) {
        event.preventDefault();
        store.setEdits(removeEdits(store.edits, store.selectedEditIds));
        store.setSelectedEdits([]);
        return;
      }
      if (event.key === " ") {
        space.current = true;
        mapRef.current?.getMap().dragPan.enable();
        return;
      }
      const shortcut = TOOL_KEYS[event.key.toLowerCase()];
      if (shortcut && !event.metaKey && !event.ctrlKey && !event.altKey) store.setEditorTool(shortcut);
    }
    function onUp(event: KeyboardEvent) {
      if (event.key !== " ") return;
      space.current = false;
      const tool = useAppStore.getState().editorTool;
      if (isDrawTool(tool)) mapRef.current?.getMap().dragPan.disable();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBasemap(basemap)
      .then((next) => {
        if (!cancelled) {
          setStyle(next);
          setStyleError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setStyleError("Could not load the basemap.");
      });
    return () => {
      cancelled = true;
    };
  }, [basemap, styleAttempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    if (flyTarget.bbox) {
      map.fitBounds(
        [
          [flyTarget.bbox.west, flyTarget.bbox.south],
          [flyTarget.bbox.east, flyTarget.bbox.north],
        ],
        { padding: 48, duration: 1400, maxZoom: 15 },
      );
      return;
    }
    map.flyTo({
      center: [flyTarget.longitude, flyTarget.latitude],
      zoom: flyTarget.zoom,
      duration: 1400,
    });
  }, [flyTarget]);

  const congestion = useMemo(() => {
    if (!frame) return null;
    const metrics = new globalThis.Map<number, CongestionLevel>();
    for (const segment of frame.segments) metrics.set(segment.roadId, segment.congestion);
    return metrics;
  }, [frame]);
  const dashboardReference = useAppStore((state) => state.dashboardReference);
  const dashboardChanged = useAppStore((state) => state.dashboardChanged);
  const dashboardChartPair = useAppStore((state) => state.dashboardChartPair);
  const mapTemplates = useAppStore((state) => state.mapTemplates);
  const templateBase = useAppStore((state) => state.templateBase);
  const editing = !templateBase && mapTemplates.length === 1 && mapTemplates[0].key.startsWith("template:");
  const compared = !templateBase && mapTemplates.length === 2 ? classifyTemplates(mapTemplates[0].edits, mapTemplates[1].edits) : null;
  const previewEdits = !editing && !templateBase && mapTemplates.length === 1 ? mapTemplates[0].edits : null;
  const scenario = useMemo(() => {
    const byWay = new globalThis.Map<number, RoadEdit["op"]>();
    const source = compared
      ? compared.filter((row) => row.edit.op !== "add").map((row) => row.edit)
      : editing
        ? edits
        : previewEdits ?? [];
    for (const edit of source) byWay.set(edit.wayId, edit.op);
    return byWay;
  }, [compared, edits, editing, previewEdits]);
  const templateSides = useMemo(() => {
    if (!compared) return null;
    const sides = new globalThis.Map<number, "first" | "second" | "both">();
    for (const row of compared) {
      if (row.edit.op === "add") continue;
      sides.set(row.edit.wayId, row.side);
    }
    return sides;
  }, [compared]);
  const liveSevereSeconds = useMemo(() => severeSecondsByRoad(readyFrames), [readyFrames]);
  const templateSummary = mapTemplates.length === 1 ? mapTemplates[0].summary : null;
  const savedSevereSeconds = useMemo(() => {
    if (templateBase || dashboardChartPair || (mapTemplates.length === 2 && mapTemplates[0].summary && mapTemplates[1].summary)) return null;
    if (templateSummary) return new globalThis.Map(templateSummary.roads.map((road) => [road.roadId, road.severeSeconds]));
    const source = dashboardChanged ?? dashboardReference;
    if (!source || (dashboardReference && dashboardChanged)) return null;
    return new globalThis.Map(source.summary.roads.map((road) => [road.roadId, road.severeSeconds]));
  }, [dashboardChanged, dashboardChartPair, dashboardReference, mapTemplates, templateBase, templateSummary]);
  const savedDelta = useMemo(() => {
    if (templateBase) return null;
    if (dashboardChartPair) return severeDelta(dashboardChartPair[1].summary.roads, dashboardChartPair[0].summary.roads);
    if (mapTemplates.length === 2 && mapTemplates[0].summary && mapTemplates[1].summary) {
      return severeDelta(mapTemplates[0].summary.roads, mapTemplates[1].summary.roads);
    }
    if (previewEdits) return null;
    if (!dashboardReference || !dashboardChanged) return null;
    return severeDelta(dashboardReference.summary.roads, dashboardChanged.summary.roads);
  }, [dashboardChanged, dashboardChartPair, dashboardReference, mapTemplates, previewEdits, templateBase]);
  const severeSeconds = templateBase ? liveSevereSeconds : savedDelta ? null : (savedSevereSeconds ?? liveSevereSeconds);
  const collection = useMemo(
    () => toRoadCollection(roads, zoom, layers, congestion, scenario, severeSeconds, savedDelta, templateSides),
    [congestion, layers, roads, savedDelta, scenario, severeSeconds, templateSides, zoom],
  );
  const vehicles = useMemo(
    () => (frame && frame.vehicles.length > 0 ? toVehicleCollection(frame.vehicles) : EMPTY_VEHICLES),
    [frame],
  );
  const casing = basemap === "light" ? "#ffffff" : "#070a10";

  function rememberLabelLayer(map: MaplibreMap) {
    if (!style) return;
    const candidate = roadInsertBeforeId(style);
    setLabelBeforeId(candidate && map.getLayer(candidate) ? candidate : undefined);
  }

  function publishView(map: MaplibreMap) {
    const bounds = map.getBounds();
    useAppStore.getState().setView(
      {
        longitude: map.getCenter().lng,
        latitude: map.getCenter().lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      },
      {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
    );
  }

  const links = useMemo(
    () =>
      compared
        ? comparedLinkCollection(compared)
        : editing
          ? linkCollection(edits, draftPoints, draftCursor, dragLine, draftInvalid, selectedEditIds, toolKind(editorTool))
          : linkCollection(previewEdits ?? [], [], null, null, false, [], "road"),
    [compared, draftCursor, draftInvalid, draftPoints, dragLine, editing, edits, editorTool, previewEdits, selectedEditIds],
  );
  const handles = useMemo(
    () => (editing ? handleCollection(edits, selectedEditIds) : handleCollection([], [])),
    [editing, edits, selectedEditIds],
  );
  const snapDot = useMemo(() => snapCollection(draftCursor, draftSnapped), [draftCursor, draftSnapped]);

  function place(lng: number, lat: number, alt: boolean) {
    const state = useAppStore.getState();
    return snapDrawPoint([lng, lat], state.roads, state.edits, state.editorTool, alt, SNAP_METERS);
  }

  function commitPath(points: LngLat[], alt: boolean) {
    const state = useAppStore.getState();
    const result = commitDrawnPath(state.edits, {
      tool: state.editorTool,
      points,
      roads: state.roads,
      alt,
      reachMeters: SNAP_METERS,
    });
    if (result.error || result.wayId == null) {
      state.setDrawError(result.error);
      return;
    }
    state.setEdits(result.edits);
    state.setDrawError(null);
    state.cancelDraft();
    state.setSelectedEdits([result.wayId]);
    openWay.current = result.wayId;
  }

  function onMouseDown(event: MapLayerMouseEvent) {
    if (space.current) return;
    const state = useAppStore.getState();
    if (!editingTemplate(state)) return;
    const handle = event.features?.find((feature) => feature.layer?.id === "scenario-handles");
    const wayId = Number(handle?.properties?.wayId);
    const index = Number(handle?.properties?.index);
    if (state.editorTool === "select" && Number.isInteger(wayId) && Number.isInteger(index)) {
      handleDrag.current = { wayId, index };
      event.target.dragPan.disable();
      return;
    }
    if (!isDrawTool(state.editorTool)) return;
    gesture.current = { x: event.point.x, y: event.point.y, lng: event.lngLat.lng, lat: event.lngLat.lat };
  }

  function onMouseUp(event: MapLayerMouseEvent) {
    const drag = handleDrag.current;
    if (drag) {
      handleDrag.current = null;
      const state = useAppStore.getState();
      const edit = state.edits.find((item) => item.op === "add" && item.wayId === drag.wayId);
      if (edit?.op === "add") {
        const surface = edit.kind === "road" || edit.kind === "highway" || edit.kind === "street";
        const atEnd = drag.index === 0 || drag.index === lineOf(edit).length - 1;
        const raw: LngLat = [event.lngLat.lng, event.lngLat.lat];
        const landed = surface && atEnd ? snapDrawPoint(raw, state.roads, state.edits, edit.kind, false, SNAP_METERS) : null;
        if (landed && !landed.snapped) {
          state.setDrawError(landed.error);
          setDragLine(null);
          return;
        }
        const points = lineOf(edit).map((point, index) => (index === drag.index ? (landed?.point ?? raw) : point));
        state.setEdits(reshapeDrawn(state.edits, drag.wayId, points));
        state.setDrawError(null);
      }
      if (state.editorTool === "select") event.target.dragPan.enable();
      setDragLine(null);
      return;
    }
    const start = gesture.current;
    gesture.current = null;
    setDragLine(null);
    if (!start) return;
    const state = useAppStore.getState();
    if (!isDrawTool(state.editorTool)) return;
    handled.current = true;
    const alt = event.originalEvent.altKey;
    const moved = Math.hypot(event.point.x - start.x, event.point.y - start.y) > 6;
    const placed = place(event.lngLat.lng, event.lngLat.lat, alt);
    if (placed.error) {
      state.setDrawError(placed.error);
      return;
    }
    const pointTool = state.editorTool === "intersection" || state.editorTool === "signal";
    if (pointTool) {
      commitPath([placed.point], alt);
      return;
    }
    if (moved && state.draftPoints.length === 0 && openWay.current == null) {
      const origin = place(start.lng, start.lat, alt);
      if (origin.error) {
        state.setDrawError(origin.error);
        return;
      }
      commitPath([origin.point, placed.point], alt);
      return;
    }
    if (openWay.current != null) {
      const edit = state.edits.find((item) => item.op === "add" && item.wayId === openWay.current);
      if (edit?.op === "add") state.setEdits(reshapeDrawn(state.edits, edit.wayId, [...lineOf(edit), placed.point]));
      return;
    }
    const next = [...state.draftPoints, placed.point];
    if (next.length >= 2) commitPath(next, alt);
    else state.setDraft(next, placed.point, false, placed.snapped);
  }

  function onClick(event: MapLayerMouseEvent) {
    if (handled.current) {
      handled.current = false;
      return;
    }
    const state = useAppStore.getState();
    if (isDrawTool(state.editorTool)) return;
    const drawn = drawnId(event.features);
    if (state.editorTool === "eraser") {
      if (drawn != null) {
        state.setEdits(removeEdits(state.edits, [drawn]));
        state.setSelectedEdits(state.selectedEditIds.filter((id) => id !== drawn));
      }
      return;
    }
    if (drawn != null) {
      const next = event.originalEvent.shiftKey
        ? state.selectedEditIds.includes(drawn)
          ? state.selectedEditIds.filter((id) => id !== drawn)
          : [...state.selectedEditIds, drawn]
        : [drawn];
      state.setSelectedEdits(next);
      return;
    }
    selectRoad(roadIdFromFeature(event.features?.[0]), event.originalEvent.shiftKey);
  }

  function onMouseMove(event: MapLayerMouseEvent) {
    const state = useAppStore.getState();
    if (handleDrag.current) {
      const edit = state.edits.find((item) => item.op === "add" && item.wayId === handleDrag.current?.wayId);
      if (edit?.op === "add" && handleDrag.current) {
        const index = handleDrag.current.index;
        setDragLine(lineOf(edit).map((point, pointIndex) => (pointIndex === index ? [event.lngLat.lng, event.lngLat.lat] : point)));
      }
      return;
    }
    if (isDrawTool(state.editorTool)) {
      const alt = event.originalEvent.altKey;
      const placed = place(event.lngLat.lng, event.lngLat.lat, alt);
      const start = gesture.current;
      if (start) {
        const origin = place(start.lng, start.lat, alt);
        setDragLine([origin.point, placed.point]);
      }
      state.setDraft(state.draftPoints, placed.point, Boolean(placed.error), placed.snapped);
      if (placed.error) state.setDrawError(placed.error);
      event.target.getCanvas().style.cursor = "crosshair";
      return;
    }
    const hovering = roadIdFromFeature(event.features?.[0]) !== null || drawnId(event.features) !== null;
    event.target.getCanvas().style.cursor = hovering ? "pointer" : "";
  }

  function onDoubleClick(event: MapLayerMouseEvent) {
    if (!isDrawTool(useAppStore.getState().editorTool)) return;
    event.preventDefault();
    openWay.current = null;
    useAppStore.getState().cancelDraft();
    setDragLine(null);
  }

  return (
    <div className="relative h-full min-h-0 bg-[#090c12]" aria-label={copy.cityMap}>
      {style ? (
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: ULAANBAATAR.longitude,
            latitude: ULAANBAATAR.latitude,
            zoom: ULAANBAATAR.zoom,
          }}
          mapStyle={style}
          maxPitch={70}
          interactiveLayerIds={["roads-hit", "roads-line", "roads-selected", "scenario-links", "scenario-handles"]}
          onLoad={(event) => {
            publishView(event.target);
            rememberLabelLayer(event.target);
          }}
          onStyleData={(event) => rememberLabelLayer(event.target)}
          onMoveEnd={(event) => publishView(event.target)}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onDblClick={onDoubleClick}
        >
          <NavigationControl visualizePitch position="top-right" />
          <Source id="roads" type="geojson" data={collection}>
            <Layer
              id="roads-casing"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={roadCasingPaint(casing)}
            />
            <Layer
              id="roads-edit-outline"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioOutlinePaint()}
              filter={["==", ["get", "scenario"], "changed"]}
            />
            <Layer
              id="roads-line"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={roadLinePaint(frame !== undefined)}
            />
            <Layer
              id="roads-closed"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioClosedPaint()}
              filter={["==", ["get", "scenario"], "closed"]}
            />
            <Layer
              id="roads-severe-seconds"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={severeSecondsPaint()}
              filter={[">", ["coalesce", ["get", "severeSeconds"], 0], 0]}
            />
            <Layer
              id="roads-severe-delta"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={severeDeltaPaint()}
              filter={["!=", ["coalesce", ["get", "severeDelta"], 0], 0]}
            />
            <Layer
              id="roads-bottleneck"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={bottleneckLinePaint()}
              filter={["==", ["get", "congestion"], "severe"]}
            />
            <Layer
              id="roads-selected"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={roadSelectionPaint()}
              filter={["in", ["get", "id"], ["literal", selectedRoadIds.length > 0 ? selectedRoadIds : [-1]]]}
            />
            <Layer
              id="roads-hit"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={roadHitPaint()}
            />
          </Source>
          <Source id="scenario-links" type="geojson" data={links}>
            <Layer
              id="scenario-bridge-casing"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioBridgeCasingPaint()}
              filter={["all", ["==", ["get", "kind"], "bridge"], ["!=", ["get", "preview"], true]]}
            />
            <Layer
              id="scenario-links"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioLinkPaint()}
              filter={["all", ["!=", ["get", "preview"], true], ["!=", ["get", "kind"], "railway"], ["!=", ["get", "selected"], true]]}
            />
            <Layer
              id="scenario-railway"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioRailwayPaint()}
              filter={["all", ["==", ["get", "kind"], "railway"], ["!=", ["get", "preview"], true], ["!=", ["get", "selected"], true]]}
            />
            <Layer
              id="scenario-link-selected"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={roadSelectionPaint()}
              filter={["==", ["get", "selected"], true]}
            />
            <Layer
              id="scenario-link-arrows"
              type="symbol"
              beforeId={labelBeforeId}
              layout={{
                "symbol-placement": "line",
                "text-field": "▶",
                "text-size": 11,
                "symbol-spacing": 48,
                "text-keep-upright": false,
              }}
              paint={{ "text-color": "#f7fbff" }}
              filter={["all", ["==", ["get", "oneway"], true], ["!=", ["get", "preview"], true]]}
            />
            <Layer
              id="scenario-link-preview"
              type="line"
              beforeId={labelBeforeId}
              layout={roadLineLayout}
              paint={scenarioPreviewPaint()}
              filter={["==", ["get", "preview"], true]}
            />
            <Layer
              id="scenario-points"
              type="circle"
              beforeId={labelBeforeId}
              paint={{
                "circle-radius": 6,
                "circle-color": [
                  "case",
                  ["==", ["get", "compare"], "first"],
                  "#e2b340",
                  ["==", ["get", "compare"], "second"],
                  "#3aa0d8",
                  ["==", ["get", "compare"], "both"],
                  "#f7fbff",
                  ["match", ["get", "kind"], "signal", "#ef4d4d", "#f7fbff"],
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#10141c",
              }}
              filter={["==", ["geometry-type"], "Point"]}
            />
          </Source>
          <Source id="scenario-handles" type="geojson" data={handles}>
            <Layer
              id="scenario-handles"
              type="circle"
              paint={{
                "circle-radius": 5,
                "circle-color": "#f7fbff",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#10141c",
              }}
            />
          </Source>
          <Source id="scenario-snap" type="geojson" data={snapDot}>
            <Layer
              id="scenario-snap"
              type="circle"
              paint={{
                "circle-radius": 4,
                "circle-color": "#3dd68c",
                "circle-stroke-width": 1,
                "circle-stroke-color": "#10141c",
              }}
            />
          </Source>
          <Source id="vehicles" type="geojson" data={vehicles}>
            <Layer
              id="vehicles"
              type="circle"
              beforeId="roads-hit"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 16, 5.5],
                "circle-color": "#ffe08a",
                "circle-stroke-width": 1,
                "circle-stroke-color": "#1c1408",
                "circle-pitch-alignment": "viewport",
              }}
            />
          </Source>
        </Map>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {styleError ? show(styleError) : copy.loadingMap}
        </div>
      )}

      {loadStatus === "loading" ? (
        <div className="pointer-events-none absolute top-3 left-3 rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-foreground shadow-sm">
          {copy.loadingRoads}
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute top-3 right-14 left-3 flex items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-2 text-xs text-foreground shadow-sm sm:left-auto sm:max-w-sm">
          <p className="min-w-0 flex-1">{show(loadError)}</p>
          <Button size="xs" variant="outline" onClick={retryLoad}>
            {copy.retry}
          </Button>
        </div>
      ) : null}

      {drawError ? (
        <div className="pointer-events-none absolute bottom-8 left-3 max-w-sm rounded-lg border border-border bg-background/95 px-3 py-2 text-xs text-destructive">
          {show(drawError)}
        </div>
      ) : null}
      <EditorToolbar />
      <TemplatePanel />
      <RunOverlay />
      {styleError && style ? (
        <div className="absolute bottom-8 left-3 rounded-lg border border-border bg-background/95 px-3 py-2 text-xs">
          <p>{show(styleError)}</p>
          <Button
            size="xs"
            variant="outline"
            className="mt-2"
            onClick={() => setStyleAttempt((attempt) => attempt + 1)}
          >
            {copy.retryBasemap}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const TOOL_KEYS: Record<string, DrawTool> = {
  "1": "road",
  "2": "oneway",
  "3": "highway",
  "4": "street",
  "5": "bridge",
  "6": "subway",
  "7": "railway",
  "8": "intersection",
  "9": "signal",
  v: "select",
  e: "eraser",
};

function editingTemplate(state: { templateBase: boolean; mapTemplates: { key: string }[] }): boolean {
  return !state.templateBase && state.mapTemplates.length === 1 && state.mapTemplates[0].key.startsWith("template:");
}

function comparedLinkCollection(rows: ReturnType<typeof classifyTemplates>) {
  const features: {
    type: "Feature";
    properties: Record<string, string | number | boolean>;
    geometry: { type: "LineString" | "Point"; coordinates: LngLat | LngLat[] };
  }[] = [];
  for (const row of rows) {
    if (row.edit.op !== "add") continue;
    const coordinates = lineOf(row.edit);
    if (row.edit.kind === "intersection" || row.edit.kind === "signal") {
      features.push({
        type: "Feature",
        properties: { kind: row.edit.kind, preview: false, selected: false, wayId: row.edit.wayId, oneway: false, invalid: false, compare: row.side },
        geometry: { type: "Point", coordinates: coordinates[0] ?? [0, 0] },
      });
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        kind: row.edit.kind,
        preview: false,
        selected: false,
        wayId: row.edit.wayId,
        oneway: row.edit.oneway === true,
        invalid: false,
        compare: row.side,
      },
      geometry: { type: "LineString", coordinates },
    });
  }
  return { type: "FeatureCollection" as const, features } as FeatureCollection<Geometry>;
}

function linkCollection(
  edits: RoadEdit[],
  draftPoints: LngLat[],
  draftCursor: LngLat | null,
  dragLine: LngLat[] | null,
  invalid: boolean,
  selected: number[],
  previewKind: string,
) {
  const features: {
    type: "Feature";
    properties: Record<string, string | number | boolean>;
    geometry: { type: "LineString" | "Point"; coordinates: LngLat | LngLat[] };
  }[] = [];
  for (const edit of edits) {
    if (edit.op !== "add") continue;
    const coordinates = lineOf(edit);
    const selectedLine = selected.includes(edit.wayId);
    if (edit.kind === "intersection" || edit.kind === "signal") {
      features.push({
        type: "Feature",
        properties: { kind: edit.kind, preview: false, selected: selectedLine, wayId: edit.wayId, oneway: false, invalid: false },
        geometry: { type: "Point", coordinates: coordinates[0] ?? [0, 0] },
      });
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        kind: edit.kind,
        preview: false,
        selected: selectedLine,
        wayId: edit.wayId,
        oneway: edit.oneway === true,
        invalid: false,
      },
      geometry: { type: "LineString", coordinates },
    });
  }
  const preview = dragLine && dragLine.length >= 2 ? dragLine : draftCursor && draftPoints.length > 0 ? [...draftPoints, draftCursor] : null;
  if (preview && preview.length >= 2) {
    features.push({
      type: "Feature" as const,
      properties: { kind: previewKind, preview: true, selected: false, wayId: 0, oneway: false, invalid },
      geometry: { type: "LineString" as const, coordinates: preview },
    });
  }
  return { type: "FeatureCollection" as const, features } as FeatureCollection<Geometry>;
}

function handleCollection(edits: RoadEdit[], selected: number[]) {
  const features = edits.flatMap((edit) => {
    if (edit.op !== "add" || !selected.includes(edit.wayId)) return [];
    if (edit.kind === "intersection" || edit.kind === "signal") return [];
    return lineOf(edit).map((coordinates, index) => ({
      type: "Feature" as const,
      properties: { wayId: edit.wayId, index },
      geometry: { type: "Point" as const, coordinates },
    }));
  });
  return { type: "FeatureCollection" as const, features } as FeatureCollection<Geometry>;
}

function snapCollection(cursor: LngLat | null, snapped: boolean) {
  if (!cursor || !snapped) return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: cursor },
      },
    ],
  } as FeatureCollection<Geometry>;
}

function lineOf(edit: Extract<RoadEdit, { op: "add" }>): LngLat[] {
  const points = edit.points ?? [edit.start, edit.end];
  return points.map((point) => [point.longitude, point.latitude]);
}

function drawnId(features: MapLayerMouseEvent["features"]): number | null {
  const feature = features?.find((item) => item.layer?.id === "scenario-links" || item.layer?.id === "scenario-railway");
  const wayId = Number(feature?.properties?.wayId);
  return Number.isInteger(wayId) && wayId > 0 ? wayId : null;
}
