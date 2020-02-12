import { loadModules } from "esri-loader";
import Map from "esri/Map";
import View from "esri/views/View";
import MapView from "esri/views/MapView";
import SceneView from "esri/views/SceneView";
import { FMViewGroup } from "./FMViewGroup";

//
// Interface for ArcGIS View event subscriber
interface IViewEventSubscriber {
  target: __esri.Accessor;
  interactWatchHandle?: __esri.WatchHandle;
  propertyWatchHandle?: __esri.WatchHandle;
  stationaryWatchHandle?: __esri.WatchHandle;
}

export class ViewEventDispatcher {
  private static theViewEventDispatcher: ViewEventDispatcher | null = null;
  private static _listener: IViewEventSubscriber | undefined = undefined;
  private static _subscribers: IViewEventSubscriber[] = [];
  private static _scheduleId: number | null = null;

  public interactWatchHandle: __esri.WatchHandle | null = null;
  public propertyWatchHandle: __esri.WatchHandle | null = null;
  public stationaryWatchHandle: __esri.WatchHandle | null = null;
  private constructor(public view: View) {}

  // public static get Dispatcher() {
  //   if (!ViewEventDispatcher.theViewEventDispatcher) {
  //     ViewEventDispatcher.theViewEventDispatcher = new ViewEventDispatcher();
  //   }
  //   return ViewEventDispatcher.theViewEventDispatcher;
  // }

  public isSubscribed(target: View): boolean {
    return ViewEventDispatcher._subscribers.find(subscriber =>
      Object.is(subscriber.target, target)
    )
      ? true
      : false;
  }

  public async subscribe(target: View): Promise<void> {
    // add if listener not already subscribed
    // const index = ViewEventDispatcher._subscribers.findIndex(subscriber =>
    //   Object.is(subscriber.target, target)
    // );
    const dispatcher = this;
    
    subscriber.interactWatchHandle = subscriber.view.watch("interacting, animation", (newValue) => {
    }

    // if (index < 0) {
    //   ViewEventDispatcher._subscribers.push({ target: target });
    //   ViewEventDispatcher.configureSubscriber(target);
    // }
  }

  public async unsubscribe(target: __esri.Accessor): Promise<void> {
    // remove the interact and animation watch events.
    const index = ViewEventDispatcher._subscribers.findIndex(subscriber =>
      Object.is(subscriber.target, target)
    );

    if (index >= 0) {
      // remove propertyWatch events
      ViewEventDispatcher.removePropertyWatchers(target);
      // remove interaction events
      if (ViewEventDispatcher._subscribers[index].interactWatchHandle) {
        ViewEventDispatcher._subscribers[index].interactWatchHandle?.remove();
      }

      // remove from list of listeners
      ViewEventDispatcher._subscribers.splice(index, 1);
    }
  }

  private static findEventSubscriber(
    target: __esri.Accessor
  ): IViewEventSubscriber | undefined {
    return ViewEventDispatcher._subscribers.find(subscriber =>
      Object.is(subscriber.target, target)
    );
  }

  private static configureSubscriber(subscriber: __esri.Accessor): void {
    const evtSubscriber = ViewEventDispatcher.findEventSubscriber(subscriber);
    if (evtSubscriber) {
      evtSubscriber.interactWatchHandle = evtSubscriber.target.watch(
        "interacting,animation",
        ViewEventDispatcher.interactHandler
      );
    }
  }

  private static addPropertyWatchers(subscriber: IViewEventSubscriber): void {
    if (subscriber) {
      subscriber.propertyWatchHandle = subscriber.target.watch(
        "viewpoint",
        ViewEventDispatcher.updateHandler
      );
    }
  }

  private static removePropertyWatchers(
    subscriber: IViewEventSubscriber | undefined
  ): void {
    if (subscriber) {
      if (subscriber) {
        subscriber.propertyWatchHandle &&
          subscriber.propertyWatchHandle.remove();
        subscriber.stationaryWatchHandle &&
          subscriber.stationaryWatchHandle.remove();
      }
    }
  }

  private static interactHandler(
    newValue: any,
    oldValue: any,
    parameterName: string,
    target: any
  ): void {
    // ignore if new state is not interacting or animating (newValue === false)
    if (!newValue) {
      return;
    }
    if (ViewEventDispatcher._listener && Object.is(ViewEventDispatcher._listener?.target, target) && )
      if (ViewEventDispatcher._scheduleId) {
        // If we have not started handling events start of prior interaction request (scheduleId not null)
        // then ignore this event
        ViewEventDispatcher._scheduleId = null;
        return;
      } else if (!ViewEventDispatcher._listener) {
        // if no current listener, set new listener from idle state
        ViewEventDispatcher.setListener(target);
        return;
      } else if (!Object.is(ViewEventDispatcher._listener, target)) {
        // If interaction begins on another subscriber, then switch the listener
        ViewEventDispatcher.switchListener(target);
      }
  }

  private static setListener(target: __esri.Accessor): void {
    console.log("Set listener...");
    const subscriber = ViewEventDispatcher.findEventSubscriber(target);
    // start updating at the next frame
    ViewEventDispatcher._scheduleId = setTimeout(() => {
      ViewEventDispatcher.addPropertyWatchers(target);
      ViewEventDispatcher._listener = subscriber;
    }, 0);

    if (target) {
      const evtSubscriber = ViewEventDispatcher.findEventSubscriber(target);
      if (evtSubscriber) {
        evtSubscriber.stationaryWatchHandle = target.watch(
          "stationary",
          ViewEventDispatcher.stationaryHandler
        );
      }
    }
  }

  private static switchListener(subscriber: __esri.Accessor): void {
    console.log("Switch listener...");
    if (ViewEventDispatcher._listener) {
      ViewEventDispatcher.removePropertyWatchers(ViewEventDispatcher._listener);
      // if ((ViewEventDispatcher._listener as View).animation) {
      //   (ViewEventDispatcher._listener as View).animation.finish();
      // }
    }
    ViewEventDispatcher.setListener(subscriber);
  }

  //
  // Update the other subscribers when a property changes on the active listener
  //

  private static updateHandler(
    newValue: any,
    oldValue: any,
    propertyName: string,
    target: any
  ): void {
    console.log("Property name " + propertyName + " value = " + newValue);
    // make sure we are only handling update events for the current listener
    if (Object.is(target, ViewEventDispatcher._listener)) {
      for (let subscriber of ViewEventDispatcher._subscribers) {
        // Skip listener on the update
        if (!Object.is(subscriber.target, ViewEventDispatcher._listener)) {
          if ((subscriber.target as MapView)[propertyName]) {
            (subscriber.target as MapView)[propertyName] = newValue;
          }
        }
      }
    }
  }

  //
  // reset listener when current interaction/animation finishes
  //

  private static stationaryHandler(
    newValue: any,
    oldValue: any,
    parameterName: string,
    target: any
  ): void {
    console.log("Stationary listener...");
    // only reset if we have a listener AND we are not still interacting with the listener
    // (even though animation may have finished)
    // !(ViewEventDispatcher._listener as View).interacting &&
    // &&
    //   !ViewEventDispatcher._scheduleId
    if (Object.is(ViewEventDispatcher._listener, target)) {
      console.log(
        "Clear listener when stationary..ScheduleID = " +
          ViewEventDispatcher._scheduleId
      );

      ViewEventDispatcher.removePropertyWatchers(ViewEventDispatcher._listener);
      ViewEventDispatcher._listener = null;
    }
  }
}

export class FMMapView {
  private _camera: __esri.Camera | undefined;
  private _baseMap2D: Map | undefined;
  private _baseMap3D: Map | undefined;
  private _syncWithGroup: boolean = true;
  private _isFinalized: boolean = false;
  private _viewType: "3D" | "2D" = "2D";
  private _interactWatcher: __esri.WatchHandle | null = null;
  private view2D: MapView | undefined;
  private view3D: SceneView | undefined;

  public activeView: MapView | SceneView | undefined;

  constructor(
    public id: string,
    private viewGroup: FMViewGroup,
    public map2DProperties?: __esri.MapProperties,
    public map3DProperties?: __esri.MapProperties
  ) {}

  public static async create(
    id: string,
    viewGroup: FMViewGroup,
    syncWithGroup: boolean = true,
    map2DProperties?: __esri.MapProperties,
    map3DProperties?: __esri.MapProperties
  ) {
    7;
    const newObject = new FMMapView(
      id,
      viewGroup,
      map2DProperties,
      map3DProperties
    );

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
    await loadModules(
      [
        "esri/Map",
        "esri/views/MapView",
        "esri/views/SceneView",
        "esri/core/watchUtils"
      ],
      {
        css: true
      }
    ).then(async ([Map, MapView, SceneView, watchUtils]) => {
      this._baseMap2D = new Map(this.map2DProperties);
      this._baseMap3D = new Map(this.map2DProperties);
      this.view2D = new MapView({
        map: this._baseMap2D,
        zoom: 2,
        rotation: 0,
        constraints: {
          snapToZoom: false
        }
      });
      this.view3D = new SceneView({
        map: this._baseMap3D,
        zoom: 2,
        rotation: 0
      });
      this._camera = this.view3D!.camera;
      this.activeView = this.view2D;
      (this.view2D!.container as any) = this.id;
      (this.view3D!.container as any) = null;
    });
  }

  public async toggleSync() {
    this.sync = !this.sync;
  }

  public async toggleView() {
    this._viewType = this._viewType === "2D" ? "3D" : "2D";
    await this.setViewType(this._viewType);
  }

  get viewType() {
    return this._viewType;
  }

  public async setViewType(viewType: "2D" | "3D") {
    if (this.activeView) {
      const isSynced = this.viewGroup.EventDispatcher.isSubscribed(
        this.activeView
      );
      // remove this view from synchronization
      this.viewGroup.EventDispatcher.unsubscribe(this.activeView);
      const activeViewpoint = this.activeView.viewpoint;
      (this.activeView.container as any) = null;
      switch (viewType) {
        case "2D":
          if (activeViewpoint?.camera) {
            this._camera = activeViewpoint?.camera;
          }
          this.view2D!.viewpoint = activeViewpoint!;
          (this.view2D!.container as any) = this.id;
          this.activeView = this.view2D;
          break;
        case "3D":
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
