import { FMMapView } from "./FMMapView";

export class FMViewGroup {
  public views: FMMapView[] = [];
  public focusedView: FMMapView | undefined;
  private nextViewId = 1;
  private syncHandles: any;
  constructor(public id: string) {}

  // Sync all other views in the group
  public async goTo(target: any) {
    for (let view of this.views) {
      if (view.activeView) {
        if (view.sync && !view.activeView.interacting) {
          if (view.activeView.animation) {
            if (view.activeView.animation.state !== "finished") {
              continue;
            }
          }
          await view.activeView.goTo(target, { animate: false });
        }
      }
    }
  }

  public async removeWatchers() {
    if (this.syncHandles) {
      for (let syncHandle of this.syncHandles) {
        const handle = await syncHandle;
        if (handle && handle.remove) {
          handle.remove();
        }
      }
    }
  }

  public async synchronizeViews() {
    await this.removeWatchers();
    if (this.syncHandles) {
      this.syncHandles.length = 0;
    }
    this.syncHandles = this.views.map(async (view, idx, views) => {
      if (view.sync) {
        let otherViews = Array.from(views);
        // remove the current view being mapped from the array of views to sync
        otherViews.splice(idx, 1);
        otherViews = otherViews.filter(
          otherView => otherView.sync && otherView.activeView
        );
        return await view.synchronizeView(view, otherViews);
      }
    });
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
    this.views.push(mapView);
    if (!this.focusedView) {
      this.focusedView = mapView;
    }
    await this.synchronizeViews();
  }

  public async removeView(id: string) {
    const index = this.views.findIndex(view => view.id === id);
    if (index >= 0) {
      // remove the view
      this.views.splice(index, 1);
      // re-synchronize the other views
      await this.synchronizeViews();
    }
  }
}
