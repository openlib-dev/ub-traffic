import { highwayFiltersForLoad, roadFromOverpassWay, type RoadFeature, type RoadNetworkSource } from "@/domain/road";
import { overpassUrls } from "@/data/config";
import { overpassQuery } from "@/data/overpass-query";

export function createOverpassRoadSource(urls = overpassUrls()): RoadNetworkSource {
  return {
    async loadRoads(bbox, detail, signal) {
      const highways = highwayFiltersForLoad(detail);
      if (highways.length === 0) return [];

      const body = `data=${encodeURIComponent(overpassQuery(bbox, highways))}`;
      let lastError: unknown;

      for (const url of urls) {
        if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body,
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35_000)]) : AbortSignal.timeout(35_000),
          });
          if (!response.ok) {
            lastError = new Error(`Overpass responded with ${response.status}`);
            continue;
          }
          const payload: unknown = await response.json();
          return roadsFromOverpassPayload(payload);
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) throw error;
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Overpass request failed");
    },
  };
}

export function roadsFromOverpassPayload(payload: unknown): RoadFeature[] {
  if (!payload || typeof payload !== "object" || !("elements" in payload)) return [];
  const elements = payload.elements;
  if (!Array.isArray(elements)) return [];
  const roads: RoadFeature[] = [];
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    const road = roadFromOverpassWay(element);
    if (road) roads.push(road);
  }
  return roads;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
