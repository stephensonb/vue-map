export interface IVehicleInfo {
  objectId: number;
  vehicleId: string;
  vehicleType: 'truck' | 'van';
  longitude: number;
  latitude: number;
  heading: number;
  speed: number;
  fuelLevel: number;
  telemetryUpdateTime?: number;
  width: number;
  depth: number;
}
