import { MapViewer } from './MapViewer';
import { MapViewEventDispatcher } from './MapViewEventDispatcher';

//
// MapViewGroup controls a set of map views and coordinates synchronization between them
//

export class MapViewGroup {
  private nextViewId = 1;
  private _viewEventDispatcher: MapViewEventDispatcher;

  public views: MapViewer[] = [];
  public focusedView: MapViewer | undefined;

  constructor(public id: string) {
    this._viewEventDispatcher = new MapViewEventDispatcher();
  }

  public get EventDispatcher() {
    return this._viewEventDispatcher;
  }

  public async addView() {
    // console.log("Create new view...");
    const mapView = await MapViewer.create(
      this.id + '-view-' + this.nextViewId++,
      this,
      { basemap: 'osm' },
      { basemap: 'osm', ground: 'world-elevation' }
    );

    // sync the view with the group as default
    mapView.sync = true;

    // Add the map view to the group list
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
