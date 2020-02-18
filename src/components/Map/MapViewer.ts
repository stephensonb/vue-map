import { ArcGIS } from './';
import Map from 'esri/Map';
import MapView from 'esri/views/MapView';
import SceneView from 'esri/views/SceneView';
import { MapViewGroup } from './MapViewGroup';
import { FleetLayerManager } from './FleetLayerManager';
import store from '@/store';

//
// MapViewer is responsible for maintaining the view state of a single map
//

export class MapViewer {
  private _camera: __esri.Camera | undefined;
  private _baseMap2D: Map | undefined;
  private _baseMap3D: Map | undefined;
  private _syncWithGroup: boolean = true;
  private _isFinalized: boolean = false;
  private _viewType: '3D' | '2D' = '2D';
  private _fleetLayerManager: FleetLayerManager | undefined;
  private view2D: MapView | undefined;
  private view3D: SceneView | undefined;

  public activeView: MapView | SceneView | undefined;

  private constructor(
    public id: string,
    private viewGroup: MapViewGroup,
    public map2DProperties?: __esri.MapProperties,
    public map3DProperties?: __esri.MapProperties
  ) {}

  public static async create(
    id: string,
    viewGroup: MapViewGroup,
    map2DProperties?: __esri.MapProperties,
    map3DProperties?: __esri.MapProperties
  ) {
    7;
    const newObject = new MapViewer(id, viewGroup, map2DProperties, map3DProperties);

    await newObject.initialize();
    newObject._isFinalized = true;
    return newObject;
  }

  get sync(): boolean {
    return this._syncWithGroup;
  }

  set sync(value: boolean) {
    if (this._isFinalized) {
      if (this.activeView) {
        if (value) {
          this.activeView.constraints = { snapToZoom: false };
          this.viewGroup.EventDispatcher.subscribe(this.activeView);
        } else {
          this.activeView.constraints = { snapToZoom: true };
          this.viewGroup.EventDispatcher.unsubscribe(this.activeView);
        }
        this._syncWithGroup = value;
      }
    }
  }

  private async initialize() {
    // Get ArcGIS modules
    const { Map, MapView, SceneView, WebScene } = await ArcGIS;

    // create maps for 2D and 3D
    this._baseMap2D = await new Map(this.map2DProperties);
    this._baseMap3D = await new WebScene(this.map3DProperties);

    // create the 2D map view
    this.view2D = await new MapView({
      map: this._baseMap2D,
    });

    // create the 3D scene view
    this.view3D = await new SceneView({
      map: this._baseMap3D,
    });

    // create the fleet layer manager for each of the views
    this._fleetLayerManager = new FleetLayerManager(this, store.state.telemetryDataProvider);

    // Set the initial view and container to display the view
    (this.view2D!.container as any) = this.id;
    (this.view3D!.container as any) = null;
    this._camera = this.view3D!.camera;
    this.activeView = this.view2D;
  }

  public async toggleSync() {
    this.sync = !this.sync;
  }

  public async toggleView() {
    this._viewType = this._viewType === '2D' ? '3D' : '2D';
    await this.setViewType(this._viewType);
  }

  get viewType() {
    return this._viewType;
  }

  public async setViewType(viewType: '2D' | '3D') {
    if (this.activeView) {
      const isSynced = this.viewGroup.EventDispatcher.isSubscribed(this.activeView);
      // remove this view from synchronization
      this.viewGroup.EventDispatcher.unsubscribe(this.activeView);
      const activeViewpoint = this.activeView.viewpoint;
      (this.activeView.container as any) = null;
      switch (viewType) {
        case '2D':
          if (activeViewpoint?.camera) {
            this._camera = activeViewpoint?.camera;
          }
          this.view2D!.viewpoint = activeViewpoint!;
          (this.view2D!.container as any) = this.id;
          this.activeView = this.view2D;
          break;
        case '3D':
          this.view3D!.viewpoint = activeViewpoint!;
          if (this._camera) {
            this.view3D!.camera = this._camera;
          }
          (this.view3D!.container as any) = this.id;
          this.activeView = this.view3D;
          break;
      }
      if (this.activeView && isSynced) {
        // if previous view was being synchronized, then sync this view
        this.viewGroup.EventDispatcher.subscribe(this.activeView);
      }
    }
  }
}
