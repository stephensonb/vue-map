import { FMMapView, ViewEventDispatcher } from "./FMMapView";

export class FMViewGroup {
  private nextViewId = 1;
  private syncHandles: any;

  public views: FMMapView[] = [];
  public focusedView: FMMapView | undefined;

  constructor(public id: string) {}

  public get EventDispatcher() {
    return ViewEventDispatcher.Dispatcher;
  }

  public async addView() {
    // console.log("Create new view...");
    const mapView = await FMMapView.create(
      this.id + "-view-" + this.nextViewId++,
      this,
      true,
      { basemap: "streets" },
      { basemap: "topo-vector", ground: "world-elevation" }
    );
    // sync the view with the group as default
    mapView.sync = true;
    this.views.push(mapView);
    if (!this.focusedView) {
      this.focusedView = mapView;
    }
  }

  public async removeView(id: string) {
    const index = this.views.findIndex(view => view.id === id);
    if (index >= 0) {
      const view = this.views[index];
      // remove syncing for this view
      view.sync = false;
      // remove the view
      this.views.splice(index, 1);
    }
  }
}
