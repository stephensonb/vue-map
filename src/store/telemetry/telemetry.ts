import {
  DataChangedHandler,
  DataItem,
  DataProvider,
  IDataSubscriberHandle,
} from '../pubsub/DataProvider';

//
// Telemetry data from a vehicle
//

export interface ITelemetry {
  objectId: number;
  vehicleId: string;
  vehicleType: 'truck' | 'van';
  longitude: number;
  latitude: number;
  heading: number;
  speed: number;
  fuelLevel: number;
  telemetryUpdateTime?: number;
}

// Define interfaces and subclasses of the generic DataProvider
export interface ITelemetryItem extends DataItem<ITelemetry> {}
export interface TelemetryDataChangedHandler extends DataChangedHandler<ITelemetryItem> {}
export interface TelemetryDataSubscriberHandle extends IDataSubscriberHandle<ITelemetryItem> {}
export class TelemetryDataProvider extends DataProvider<ITelemetry> {
  constructor() {
    super();
  }
}
