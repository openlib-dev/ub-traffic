import { useEffect, useMemo, useRef } from "react";
import {
  bboxContains,
  expandBBox,
  highwayFiltersForLoad,
  isLoadableBBox,
  isSubset,
  type BBox,
} from "@/domain/road";
import { isAbortError } from "@/data/overpass-road-source";
import { createRoadNetworkSource } from "@/data/road-network-source";
import { useAppStore } from "@/state/use-app-store";

const LOAD_DEBOUNCE_MS = 400;

export function useRoadLoader() {
  const viewToken = useAppStore((state) => state.viewToken);
  const layers = useAppStore((state) => state.layers);
  const retryToken = useAppStore((state) => state.retryToken);
  const source = useMemo(() => createRoadNetworkSource(), []);
  const attempt = useRef<{ bbox: BBox | null; highways: string[]; retry: number }>({
    bbox: null,
    highways: [],
    retry: -1,
  });

  useEffect(() => {
    const { viewBBox, camera, ingestRoads, setLoadStatus } = useAppStore.getState();
    if (!viewBBox) return;

    if (!isLoadableBBox(viewBBox)) {
      setLoadStatus("error", "Zoom in to load roads for this view.");
      return;
    }

    const detail = { zoom: camera.zoom, layers };
    const highways = highwayFiltersForLoad(detail);
    if (highways.length === 0) {
      setLoadStatus("ready");
      return;
    }

    const requested = isLoadableBBox(expandBBox(viewBBox, 0.35))
      ? expandBBox(viewBBox, 0.35)
      : viewBBox;
    const previous = attempt.current;
    const covered =
      previous.retry === retryToken &&
      previous.bbox !== null &&
      isSubset(highways, previous.highways) &&
      bboxContains(previous.bbox, viewBBox);
    if (covered) return;

    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadStatus("loading");
        try {
          const incoming = await source.loadRoads(requested, detail, controller.signal);
          if (cancelled) return;
          const latestView = useAppStore.getState().viewBBox ?? viewBBox;
          attempt.current = { bbox: requested, highways, retry: retryToken };
          ingestRoads(incoming, latestView);
        } catch (error) {
          if (cancelled || isAbortError(error)) return;
          attempt.current = { bbox: null, highways: [], retry: retryToken };
          setLoadStatus(
            "error",
            "Could not load roads from OpenStreetMap. Try again in a moment.",
          );
        }
      })();
    }, LOAD_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [layers, retryToken, source, viewToken]);
}
