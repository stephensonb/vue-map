import { IDataPublisherHandle, DataItem } from '../pubsub/DataProvider';
import { IVehicleInfo } from './IVehicleInfo';
import { ITelemetryItem, ITelemetry } from './telemetry';
import { vehicleData } from './vehicleData';
import store from '@/store';
import GeoMath from '@/store/telemetry/geoMath';

//
// Simple simulator to move a vehicle along a heading at a certain speed.
// Updated coordinates are published to the "vehicle-telemetry" channel of the TelemetryDataProvider that is defined
// in the Vuex store
//

export class Simulator {
  private _publishHandle: IDataPublisherHandle<ITelemetry>;
  private _processId: any | null = null;
  private _fleet: IVehicleInfo[] = [];
  private _frameInterval = 1000;

  constructor(delay = 10000) {
    this._publishHandle = store.state.telemetryDataProvider.registerPublisher(
      'simulator',
      'vehicle-telemetry'
    );
    // load initial dataset
    this._fleet = this._fleet.concat(vehicleData);
    setTimeout(() => {
      this._publishHandle.publish(this._fleet);
    }, delay);
  }

  public start(delay: number, frameInterval = 5000) {
    if (this._processId) {
      return;
    }

    this._processId = setInterval(this.nextFrame(this), frameInterval);
  }

  public nextFrame = (simulator: Simulator) => {
    let busy = false;
    return () => {
      if (busy) {
        return;
      }
      busy = true;
      const frameData: ITelemetry[] = [];
      for (let i = 0; i < simulator._fleet.length; i++) {
        const vehicle = simulator._fleet[i];
        const distanceTraveled =
          (GeoMath.mphToMetersPerSecond(vehicle.speed) * simulator._frameInterval) / 1000;
        const newCoords = GeoMath.destination(
          { lat: vehicle.latitude, lon: vehicle.longitude },
          vehicle.heading,
          distanceTraveled
        );
        vehicle.latitude = newCoords.coord2.lat;
        vehicle.longitude = newCoords.coord2.lon;
        vehicle.heading = newCoords.bearing + 1;
        if (vehicle.heading > 360) {
          vehicle.heading -= 360;
        }
        frameData.push(vehicle);
      }

      // only publish if provider is ready
      if (this._publishHandle.ready) {
        simulator._publishHandle.publish(frameData);
      }
      busy = false;
    };
  };
}
