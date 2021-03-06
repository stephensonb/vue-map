import View from "esri/views/View";

//
// Interface for ArcGIS View event subscriber
//
export interface IMapViewEventSubscriber {
  target: View;
  scheduleId?: number;
  interactWatchHandle?: __esri.WatchHandle;
  propertyWatchHandle?: __esri.WatchHandle;
  stationaryWatchHandle?: __esri.WatchHandle;
}
