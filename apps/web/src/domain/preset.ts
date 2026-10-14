import type { BBox } from "@/domain/road";
import type { SimulationConfig } from "@/domain/simulation";

/** demandIntensity is the number of passenger-car trips inserted across the window. */
export const MORNING_PEAK: {
  label: string;
  districtName: string;
  detail: string;
  district: BBox;
  config: SimulationConfig;
} = {
  label: "Morning peak, estimated",
  districtName: "Ulaanbaatar",
  detail: "Synthetic demand, not calibrated counts. Passenger cars only. Most trips head toward offices and universities.",
  district: { west: 106.75, south: 47.82, east: 107.2, north: 48.05 },
  config: {
    scenarioId: "ulaanbaatar-morning",
    startTime: "07:30",
    endTime: "07:45",
    demandIntensity: 2000,
    speed: 1,
    seed: 42,
  },
};
