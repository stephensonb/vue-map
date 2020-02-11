import { loadModules } from "esri-loader";
import Map from "esri/Map";
import MapView from "esri/views/MapView";
import SceneView from "esri/views/SceneView";
import { FMViewGroup } from "./FMViewGroup";

interface EventListener {
  target: __esri.Accessor;
  interactWatchHandle?: __esri.WatchHandle;
  propertyWatchHandle?: __esri.WatchHandle;
  stationaryWatchHandle?: __esri.WatchHandle;
}

export class EventDispatcher {
  private static _theDispatcher: EventDispatcher | null = null;
  private _talker: __esri.Accessor | null = null;
  private _listeners: EventListener[] = [];
  private _scheduleId: number | null = null;

  static get Dispatcher() {
    if (!this._theDispatcher) {
      this._theDispatcher = new EventDispatcher();
      return this._theDispatcher;
    } else {
      return this._theDispatcher;
    }
  }

  public subscribe(subscriber: __esri.Accessor) {
    // add if listener not already subscribed
    const index = this._listeners.findIndex(listener =>
      Object.is(listener.target, subscriber)
    );
    this.addEvents(subscriber);
    if (index < 0) {
      this._listeners.push({ target: subscriber });
    }
  }

  public unsubscribe(subscriber: __esri.Accessor) {
    const index = this._listeners.findIndex(listener =>
      Object.is(listener.target, subscriber)
    );
    // remove propertyWatch events
    this.removePropertyWatchers(this._listeners[index]);

    // remove the interact and animation watch events.
    if (this._listeners[index].interactWatchHandle) {
      this._listeners[index].interactWatchHandle!.remove();
    }

    // remove from list of listeners
    if (index >= 0) {
      this._listeners.splice(index, 1);
    }
  }

  private addEvents(subscriber: __esri.Accessor) {
    subscriber.watch("interacting,animation", this.interactHandler);
  }

  private addPropertyWatchers(talker: __esri.Accessor) {
    talker.watch("viewpoint", this.updateHandler);
  }

  private removePropertyWatchers(listener: EventListener | null | undefined) {
    if (listener) {
      listener.propertyWatchHandle && listener.propertyWatchHandle.remove();
      listener.stationaryWatchHandle && listener.stationaryWatchHandle.remove();
    }
  }

  private interactHandler(
    newValue: any,
    oldValue: any,
    parameterName: string,
    target: any
  ) {
    if (this._talker) {
      // If we have not started handling events start of prior interaction request (scheduleId not null)
      // then ignore this event
      if (this._scheduleId) {
        return;
      } else if (Object.is(this._talker, target)) {
        // If interaction begins on another object, then switch the talker
        this.switchTalker(target);
      } else {
        // clear the schedule ID indicating we are ready to start processing property change events
        this._scheduleId = null;
        return;
      }
    } else {
      // new talker from idle state
      this.setTalker(target);
    }
  }

  private setTalker(toSubscriber: __esri.Accessor) {
    // start updating at the next frame
    this._scheduleId = setTimeout(() => {
      this.addPropertyWatchers(toSubscriber);
      this._talker = toSubscriber;
    }, 0);

    if (toSubscriber) {
      toSubscriber.watch("stationary", this.stationaryHandler);
    }
  }

  private switchTalker(toSubscriber: __esri.Accessor) {
    if (this._talker) {
      this.removePropertyWatchers(
        this._listeners.find(listener =>
          Object.is(listener.target, this._talker)
        )
      );
    }
    this.setTalker(toSubscriber);
  }

  // Update the other listeners when a property changes
  private updateHandler(
    newValue: any,
    oldValue: any,
    propertyName: string,
    target: any
  ) {
    // make sure we are only handling update events for the current talker
    if (Object.is(target, this._talker)) {
      for (let listener of this._listeners) {
        // Skip talker
        if (!Object.is(listener.target, this._talker)) {
          if (listener.target[propertyName]) {
            listener.target[propertyName] = newValue;
          }
        }
      }
    }
  }

  // reset talker when current interaction/animation finishes
  private stationaryHandler(
    newValue: any,
    oldValue: any,
    parameterName: string,
    target: any
  ) {}
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
    newObject.sync = syncWithGroup;
    newObject._isFinalized = true;
    return newObject;
  }

  get sync(): boolean {
    return this._syncWithGroup;
  }

  set sync(value: boolean) {
    this._syncWithGroup = value;
    if (this._isFinalized) {
      this.viewGroup.synchronizeViews();
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
    this._viewType === "2D" ? "3D" : "2D";
    await this.setViewType(this._viewType);
    if (this._isFinalized) {
      this.viewGroup.synchronizeViews();
    }
  }

  get viewType() {
    return this._viewType;
  }

  public async setViewType(viewType: "2D" | "3D") {
    const activeViewpoint = this.activeView?.viewpoint;
    (this.activeView!.container as any) = null;
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
  }

  public async synchronizeView(view: FMMapView, otherViews: FMMapView[]) {
    return await loadModules(["esri/core/watchUtils"]).then(
      ([watchUtils]): any => {
        // ignore request if this view is already synchronized
        if (!view.activeView || this._interactWatcher) {
          return;
        }
        let viewpointWatchHandle: __esri.WatchHandle | null;
        let viewStationaryHandle: __esri.WatchHandle | null;
        let interactWatcher: __esri.WatchHandle | null;
        let otherViewInteractHandles: __esri.WatchHandle[] = [];
        let scheduleId: number | null;

        // clean up all watchers and reset
        const clear = () => {
          if (otherViewInteractHandles) {
            for (let handle of otherViewInteractHandles) {
              if (handle) {
                handle.remove();
              }
            }
            otherViewInteractHandles.length = 0;
          }
          viewpointWatchHandle && viewpointWatchHandle.remove();
          viewStationaryHandle && viewStationaryHandle.remove();
          scheduleId && clearTimeout(scheduleId);
          viewpointWatchHandle = null;
          viewStationaryHandle = null;
          scheduleId = null;
        };

        // setup watchers and the callback for view changes
        interactWatcher = view.activeView.watch(
          "interacting, animation",
          (newValue, oldValue, propertyName, target) => {
            // console.log("Interact event received.....");
            // console.log(
            //   "Active Obj  :" + Object.is(target, this.activeView)
            // );
            // console.log("...Target   : " + (target as any).container.id);
            // console.log("...Property : " + propertyName);
            // console.log("...New Value: " + newValue);
            // console.log("...Old Value: " + oldValue);
            if (!newValue) {
              return;
            }
            // If still updating viewpoints then ignore interact/animation change
            if (viewpointWatchHandle || scheduleId) {
              return;
            }
            // start updating views at the next tick/frame
            scheduleId = setTimeout(() => {
              scheduleId = null;
              // Set watcher for viewpoint changes, update all other views when this view
              // changes viewpoint
              viewpointWatchHandle = view.activeView!.watch(
                "viewpoint",
                newValue => {
                  for (let otherView of otherViews) {
                    otherView.activeView!.viewpoint = newValue;
                  }
                }
              );
            }, 0);

            // watch other views in the group for interaction.  If user starts interacting
            // with those, then stop current event handling on this view by removing all watchers
            otherViewInteractHandles = otherViews.map(otherView => {
              return watchUtils.watch(
                otherView.activeView,
                "interacting, animation",
                (value: any) => {
                  if (value) {
                    clear();
                  }
                }
              );
            });

            // stop processing when view is stationary
            viewStationaryHandle = watchUtils.whenTrue(
              view.activeView,
              "stationary",
              () => {
                for (let otherView of otherViews) {
                  otherView.activeView!.viewpoint = view.activeView!.viewpoint;
                }
                clear();
              }
            );
          }
        ); // end interactWatcher

        return {
          remove: function() {
            this.remove = function() {};
            clear();
            interactWatcher && interactWatcher.remove();
          }
        };
      }
    );
  }
}
