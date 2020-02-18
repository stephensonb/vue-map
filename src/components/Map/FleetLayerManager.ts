import { ArcGIS } from '@/components/Map';
import store from '@/store';
import {
  ITelemetryItem,
  TelemetryDataProvider,
  TelemetryDataSubscriberHandle,
} from '@/store/telemetry/telemetry';
import FeatureLayer from 'esri/layers/FeatureLayer';
import SimpleRenderer from 'esri/renderers/SimpleRenderer';
import UniqueValueRenderer from 'esri/renderers/UniqueValueRenderer';
import WebStyleSymbol from 'esri/symbols/WebStyleSymbol';
import Query from 'esri/tasks/support/Query';
import MapView from 'esri/views/MapView';
import SceneView from 'esri/views/SceneView';
import { MapViewer } from './MapViewer';

//
// FleetViewManager manages the viewing and appearance of a fleet on a map view.
// MapViewer will register an instance of this class to manage the fleet visulization on its
// map.
//
export class FleetLayerManager {
  private _vehicleDataHandle: TelemetryDataSubscriberHandle | undefined;
  private _mapViewer: MapViewer;
  private _vehicleLayer2D: FeatureLayer | undefined;
  private _vehicleLayer3D: FeatureLayer | undefined;

  constructor(viewer: MapViewer, dataSource: TelemetryDataProvider) {
    this._mapViewer = viewer;
    this.initialize(dataSource);
  }

  private async initialize(dataSource?: TelemetryDataProvider) {
    this._vehicleDataHandle = store.state.telemetryDataProvider.registerSubscriber(
      this._mapViewer.id,
      await this.vehicleDataHandler(this),
      'vehicle-data'
    );
  }

  public async vehicleDataHandler(self: FleetLayerManager) {
    const { scheduling } = await ArcGIS;

    const buffer: ITelemetryItem[][] = [];
    // only buffer updates before ignoring update requests
    const MAX_BUFFER_SIZE = 2;

    return async (items: ITelemetryItem[]) => {
      // push the update request to the update buffer
      if (buffer.length < MAX_BUFFER_SIZE) {
        buffer.push(items);
      } else {
        // buffer full
        return;
      }
      // while we have pending updates
      while (buffer.length > 0) {
        const updates = buffer[0];
        await self.updateFeatures(updates);
        buffer.shift();
      }
    };
  }

  //
  // Return layer depending on view type => 2d or 3d
  //

  private async getFeatureLayer(view: MapView | SceneView) {
    const scale = this._mapViewer.activeView?.scale;

    if (view.type === '2d') {
      if (!this._vehicleLayer2D) {
        this._vehicleLayer2D = await this.createVehicleLayer2D();
        this._mapViewer.activeView?.map.add(this._vehicleLayer2D);
      }
      return this._vehicleLayer2D;
    }

    if (!this._vehicleLayer3D) {
      this._vehicleLayer3D = await this.createVehicleLayer3D();
      this._mapViewer.activeView?.map.add(this._vehicleLayer3D);
    }

    return this._vehicleLayer3D;
  }

  //
  // Updates graphic with new data from the data provider.  If the vehicle does not exist on the layer,
  // a new graphic will be created.
  //

  public async updateFeatures(items: ITelemetryItem[]) {
    // load the necessary ArcGIS modules
    const { Graphic, Point, Query } = await ArcGIS;

    // don't update if we have no active view, its not ready, it is updating or it is not stationary
    if (
      !this._mapViewer.activeView ||
      !this._mapViewer.activeView?.ready ||
      //      !this._mapViewer.activeView?.updating ||
      !this._mapViewer.activeView.stationary
    ) {
      return;
    }

    let cancelOperation = false;

    // watch for stationary changes on the view.  If it starts moving (pan, tile, rotate or zoom) then
    // quit updating.
    const readyHandle = this._mapViewer.activeView.watch('stationary', value => {
      if (!value) {
        readyHandle.remove();
        cancelOperation = true;
      } else {
        readyHandle.remove();
      }
    });

    // get a list of features in the current view
    const layer: FeatureLayer = await this.getFeatureLayer(this._mapViewer.activeView);
    const query: Query = new Query();
    query.returnGeometry = true;
    query.outFields = ['objectId', 'heading', 'depth', 'vehicleId'];
    const features = (await layer.queryFeatures(query)).features;

    // if they are on the layer already, we update the coords, if not we add the vehicle
    for (let i = 0; i < items.length; i++) {
      const vehicle = items[i].data;
      const vehicleLocation = new Point({
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      });
      let j = 0;
      let addValue = true;
      for (; j < features.length; j++) {
        // If ready state of the current view changed, then cancel the update operation
        if (cancelOperation) {
          return;
        }
        if (vehicle.objectId === features[j].attributes.objectId) {
          addValue = false;
          break;
        }
      }
      // Add a vehicle to the layer
      if (addValue) {
        const newGraphic = await new Graphic({
          geometry: vehicleLocation,
          attributes: { ...vehicle },
        });
        await layer.applyEdits({
          addFeatures: [newGraphic],
        });
      } else {
        // Update an existing vehicle on the layer
        const featureToUpdate = features[j];
        featureToUpdate.geometry = vehicleLocation;
        featureToUpdate.attributes.heading = vehicle.heading;
        await layer.applyEdits({
          updateFeatures: [featureToUpdate],
        });
      }
    }
  }

  //
  // Create the feature layer for 2D views
  //

  public async createVehicleLayer2D(): Promise<FeatureLayer> {
    // load the necessary ArcGIS modules
    const { PictureMarkerSymbol, UniqueValueRenderer } = await ArcGIS;

    const van = await new PictureMarkerSymbol({
      url: require('../../assets/blue-van-top.png'),
      width: 10,
      height: 20,
    });
    const truck = await new PictureMarkerSymbol({
      url: require('../../assets/white-truck-top.png'),
      width: 12,
      height: 50,
    });

    let vehicleRenderer2D: UniqueValueRenderer = await new UniqueValueRenderer({
      legendOptions: 'Vehicle Type',
      defaultSymbol: van,
      defaultLabel: 'Unknown',
      field: 'vehicleType',
      uniqueValueInfos: [
        {
          value: 'truck',
          symbol: truck,
        },
        {
          value: 'van',
          symbol: van,
        },
      ],
      visualVariables: [
        {
          type: 'rotation',
          field: 'heading',
          rotationType: 'geographic',
        },
      ],
    });

    const labelClass = {
      symbol: {
        type: 'text',
        color: 'black',
        font: {
          family: 'Arial',
          size: 12,
          weight: 'bold',
        },
        haloColor: 'white',
        haloSize: 2,
      },
      labelPlacement: 'above-center',
      labelExpressionInfo: { expression: '$feature.vehicleId' },
    };

    return await this.createFeatureLayer('vehicles-2d', vehicleRenderer2D, labelClass);
  }

  //
  // Create the feature layer for 3D views
  //

  public async createVehicleLayer3D(/*graphics: Graphic[]*/): Promise<FeatureLayer> {
    // load the necessary ArcGIS modules
    const { WebStyleSymbol, UniqueValueRenderer } = await ArcGIS;

    // Define the symbols for the vehicles
    const van: WebStyleSymbol = await new WebStyleSymbol({
      name: 'Ford_Transit_Connect',
      styleName: 'EsriRealisticTransportationStyle',
    });

    const truck = new WebStyleSymbol({
      name: 'Truck_With_Trailer',
      styleName: 'EsriRealisticTransportationStyle',
    });

    // Renderer for the layer
    let vehicleRenderer3D: UniqueValueRenderer = await new UniqueValueRenderer({
      legendOptions: 'Vehicle Type',
      field: 'vehicleType',
      defaultSymbol: van,
      defaultLabel: 'Unknown',
      uniqueValueInfos: [
        {
          value: 'van',
          symbol: van,
        },
        {
          value: 'truck',
          symbol: truck,
        },
      ],
      visualVariables: [
        {
          type: 'rotation',
          field: 'heading',
          rotationType: 'geographic',
        },
        {
          type: 'size',
          axis: 'depth',
          field: 'depth',
        },
      ],
    });

    // define label appearance and callout for the layer
    const labelClass = {
      labelPlacement: 'above-center',
      labelExpressionInfo: { expression: '$feature.vehicleId' },
      symbol: {
        type: 'label-3d',
        symbolLayers: [
          {
            type: 'text',
            material: {
              color: 'black',
            },
            font: 'Arial',
            size: 12,
            halo: {
              color: [255, 255, 255, 0.5],
              size: 2,
            },
          },
        ],
        verticalOffset: {
          screenLength: 50,
          maxWorldLength: 2000,
          minWorldLength: 30,
        },
        callout: {
          type: 'line',
          size: 1,
          color: [0, 0, 0],
          border: {
            color: [255, 255, 255],
          },
        },
      },
    };

    return await this.createFeatureLayer('vehicles-3d', vehicleRenderer3D, labelClass);
  }

  //
  // Common function to create the feature layer for both 2D and 3D views
  //

  private async createFeatureLayer(
    id: string,
    renderer: SimpleRenderer | UniqueValueRenderer,
    labelClass?: any
  ) {
    const { FeatureLayer } = await ArcGIS;

    const popupDetails = {
      title: '{vehicleId}',
      content:
        '<b>Type:</b> {vehicleType}<br><b>Speed:</b> {speed} mph<br><b>Fuel Level:</b> {fuelLevel}',
    };

    const layer = await new FeatureLayer({
      id,
      source: [],
      geometryType: 'point',
      objectIdField: 'objectId',
      popupTemplate: popupDetails,
      fields: [
        {
          name: 'objectId',
          type: 'oid',
        },
        {
          name: 'vehicleId',
          type: 'string',
        },
        {
          name: 'vehicleType',
          type: 'string',
        },
        {
          name: 'fuelLevel',
          type: 'double',
        },
        {
          name: 'speed',
          type: 'double',
        },
        {
          name: 'heading',
          type: 'double',
        },
        {
          name: 'longitude',
          type: 'double',
        },
        {
          name: 'latitude',
          type: 'double',
        },
        {
          name: 'depth',
          type: 'integer',
        },
      ],
      renderer,
      elevationInfo: {
        mode: 'on-the-ground',
      },
    });
    if (labelClass) {
      layer.labelingInfo = [labelClass];
    }
    return layer;
  }
}
