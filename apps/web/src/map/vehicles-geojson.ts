import type { FeatureCollection, Point } from "geojson";
import type { VehiclePosition } from "@/domain/simulation";

export const EMPTY_VEHICLES: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

export function toVehicleCollection(vehicles: readonly VehiclePosition[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => ({
      type: "Feature",
      id: vehicle.id,
      properties: { id: vehicle.id, bearing: vehicle.bearing },
      geometry: {
        type: "Point",
        coordinates: [vehicle.longitude, vehicle.latitude],
      },
    })),
  };
}
