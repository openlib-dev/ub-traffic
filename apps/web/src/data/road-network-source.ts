import { type RoadNetworkSource } from "@/domain/road";
import { createLocalRoadSource, viewUsesLocalExtract } from "@/data/local-roads";
import { createOverpassRoadSource } from "@/data/overpass-road-source";

export function createRoadNetworkSource(): RoadNetworkSource {
  const local = createLocalRoadSource();
  const remote = createOverpassRoadSource();

  return {
    async loadRoads(bbox, detail, signal) {
      const coverage = await local.coverage();
      if (viewUsesLocalExtract(coverage, bbox)) {
        return local.loadRoads(bbox, detail, signal);
      }
      return remote.loadRoads(bbox, detail, signal);
    },
  };
}
