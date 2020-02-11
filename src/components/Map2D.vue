<template>
  <div class="map-view-container">
    <div :id="this.$attrs.id" class="map-view"></div>
    <div :id="infoDivId" class="esri-component toggle-widget esri-widget">
      <div
        class="esri-widget--button esri-widget esri-interactive"
        id="switch-btn"
        role="button"
        @click="toggleView"
      >
        {{ buttonText }}
      </div>
      <div
        class="esri-widget--button esri-widget esri-interactive"
        id="syncBtn"
        role="button"
        @click="toggleSync"
      >
        <i class="material-icons">{{ syncButtonIcon }}</i>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import { loadModules } from "esri-loader";
import Map from "esri/Map";
import MapView from "esri/views/MapView";
import SceneView from "esri/views/SceneView";
import Camera from "esri/Camera";
import WatchHandle from "esri/core/Handles";
import Point from "esri/geometry/Point";

type ViewExtent = {
  center: [number, number, number?];
  scale: number;
  zoom: number;
  rotation: number;
};

export default Vue.extend({
  name: "map-2d",
  inheritAttrs: false,
  props: {
    viewCenter: {
      type: Object,
      default: null
    },
    viewZoom: {
      type: Number,
      default: 13
    },
    viewScale: {
      type: Number,
      default: 24000
    },
    viewRotation: {
      type: Number,
      default: 0
    },
    viewType: {
      type: String,
      default: "2D"
    }
  },
  data() {
    return {
      locals: {
        viewCenter: this.viewCenter as __esri.Point,
        viewZoom: this.viewZoom as number,
        viewScale: this.viewZoom as number,
        viewRotation: this.viewRotation as number,
        viewType: this.viewType
      },
      syncWithGroup: true,
      view2D: {
        view: null as MapView | null
      },
      view3D: {
        view: null as SceneView | null,
        camera: null as Camera | null
      },
      activeView: null as MapView | SceneView | null,
      viewContainer: null as HTMLDivElement | null,
      watchHandles: [] as __esri.WatchHandle[]
    };
  },
  methods: {
    toggleView(): void {
      this.switchView(this.locals.viewType === "2D" ? "3D" : "2D");
    },
    toggleSync(): void {
      this.syncWithGroup = !this.syncWithGroup;
      if (this.syncWithGroup) {
        // synchronize view parameters with the group
        this.goTo({
          center: this.viewCenter as __esri.Point,
          zoom: this.viewZoom,
          scale: this.viewScale,
          rotation: this.viewRotation
        });
        // add handlers to watch for view changes
        this.addWatchHandlers(this.activeView);
      } else {
        this.removeWatchHandlers();
      }
    },
    switchView(type: "2D" | "3D"): void {
      // return if new view type is same as current
      if (type === this.locals.viewType) {
        return;
      }
      this.removeWatchHandlers();
      // @ts-ignore
      let activeViewPoint = this.activeView.viewpoint;
      // @ts-ignore
      this.activeView.container = null;
      if (type === "3D") {
        this.view3D!.view!.viewpoint = activeViewPoint;
        if (this.view3D.camera) {
          // restore camera properties for the view
          this.view3D!.view!.camera = this.view3D.camera!;
        }
        // @ts-ignore
        this.view3D!.view!.container = this.viewContainer;
        this.activeView = this.view3D.view;
      } else {
        // save camera properties from 3D view
        this.view3D!.camera = (this.activeView as SceneView).camera;
        this.view2D!.view!.viewpoint = activeViewPoint;
        // @ts-ignore
        this.view2D!.view!.container = this.viewContainer;
        this.activeView = this.view2D.view;
      }
      this.addWatchHandlers(this.activeView);
      this.locals.viewType = type;
    },
    removeWatchHandlers() {
      this.watchHandles.forEach((handle: __esri.WatchHandle) => {
        handle.remove();
      });
      this.watchHandles.length = 0;
    },
    addWatchHandlers(view: MapView | SceneView | null) {
      // only add if we are syncing with the group
      if (this.syncWithGroup) {
        if (view) {
          this.watchHandles.push(
            view.watch(
              "center,scale,rotation,zoom,focused",
              this.mapChanged as __esri.WatchCallback
            )
          );
          if (view.animation) {
            this.watchHandles.push(
              view.animation.watch(
                "state",
                this.mapChanged as __esri.WatchCallback
              )
            );
          }
        }
      }
    },
    mapChanged(
      newValue: any,
      oldValue: any,
      propertyName: string,
      target: any
    ) {
      const eventValue = { id: this.$attrs.id, value: newValue };
      if (propertyName === "focused") {
        this.$emit("update:viewFocused", eventValue);
      } else {
        // only emit change events if this view is being interacted with directly
        if (this.activeView!.interacting) {
          if (this.viewType == "3D" && propertyName === "state") {
            target.animation.finish();
            return;
          }
          console.log(
            this.$attrs.id +
              " update map properties: " +
              JSON.stringify(newValue)
          );
          switch (propertyName) {
            case "center":
              this.$emit("update:viewCenter", eventValue);
              break;
            case "zoom":
              this.$emit("update:viewZoom", eventValue);
              break;
            case "scale":
              this.$emit("update:viewScale", eventValue);
              break;
            case "rotation":
              this.$emit("update:viewRotation", eventValue);
              break;
            default:
              break;
          }
        }
      }
    },
    async goTo(
      target: {
        center?: __esri.Point;
        scale?: number;
        zoom?: number;
        rotation?: number;
      },
      options?: { animate?: false }
    ) {
      console.log(
        this.$attrs.id + " Moving to new target :" + JSON.stringify(target)
      );
      //await this.waitForAnimationFinish();
      this.activeView!.goTo(target, options).then(done => {
        if (target.center) this.locals.viewCenter = target.center;
        if (target.scale) this.locals.viewScale = target.scale;
        if (target.zoom) this.locals.viewZoom = target.zoom;
        if (target.rotation) this.locals.viewRotation = target.rotation;
      });
    },
    async waitForAnimationFinish(timeout = 100) {
      const startTime = Date.now();
      if (this.activeView!.animation && !this.activeView!.interacting) {
        console.log("Waiting for animation to stop.");
        while (
          !["finished", "stopped"].includes(this.activeView!.animation.state)
        ) {
          if (Date.now() - startTime > timeout) {
            console.log("Timed out...");
            break;
          }
        }
      }
    }
  },
  computed: {
    buttonText(): string {
      return this.locals.viewType === "2D" ? "3D" : "2D";
    },
    syncButtonIcon(): string {
      return this.syncWithGroup ? "lock" : "lock_open";
    },
    infoDivId(): string {
      return this.$attrs.id + "-info";
    }
  },
  watch: {
    syncWithGroup(newValue, oldValue) {
      if (newValue !== this.syncWithGroup) {
        this.toggleSync();
      }
    },
    viewType(newValue, oldValue) {
      // If view changed to different than current, then toggle view, otherwise do nothing.
      if (newValue != this.locals.viewType) {
        this.toggleView();
      }
    },
    viewCenter(newValue, oldValue) {
      if (this.syncWithGroup && !this.activeView!.interacting) {
        // console.log("View center changed:" + JSON.stringify(newValue));
        this.goTo({ center: newValue });
      }
    },
    viewZoom(newValue, oldValue) {
      if (this.syncWithGroup && !this.activeView!.interacting) {
        // console.log("View zoom changed:" + JSON.stringify(newValue));
        this.goTo({ zoom: newValue });
      }
    },
    viewScale(newValue, oldValue) {
      if (this.syncWithGroup && !this.activeView!.interacting) {
        // console.log("View scale changed:" + JSON.stringify(newValue));
        this.goTo({ scale: newValue });
      }
    },
    viewRotation(newValue, oldValue) {
      if (this.syncWithGroup && !this.activeView!.interacting) {
        // console.log("View rotation changed:" + JSON.stringify(newValue));
        this.goTo({ rotation: newValue });
      }
    }
  },
  mounted() {
    loadModules(["esri/Map", "esri/views/MapView", "esri/views/SceneView"], {
      css: true
    }).then(([Map, MapView, SceneView]) => {
      const map2D = new Map({
        basemap: "streets"
      });
      const map3D = new Map({
        basemap: "streets",
        ground: "world-elevation"
      });

      this.viewContainer = document.getElementById(
        this.$attrs.id
      ) as HTMLDivElement;

      this.view2D.view = new MapView({
        container: this.viewContainer,
        zoom: this.viewZoom,
        center: this.viewCenter,
        rotation: this.viewRotation
      });

      this.locals.viewScale = this.view2D!.view!.scale;

      this.view3D.view = new SceneView({
        container: null,
        zoom: this.viewZoom,
        center: this.viewCenter,
        rotation: this.viewRotation,
        scale: this.locals.viewScale
      });

      this.view2D.view!.map = map2D;
      this.view3D.view!.map = map3D;

      // @ts-ignore
      this.activeView = this.view2D.view;

      // add handlers to watch for events
      if (this.syncWithGroup) {
        this.addWatchHandlers(this.activeView);
      }
    });
  }
});
</script>

<style scoped>
.map-view-container {
  position: relative;
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}

.map-view {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.toggle-widget {
  position: absolute;
  top: 15px;
  left: 50px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-flow: column nowrap;
}

.toggle-widget div:last-child {
  border-top: 1px solid rgba(100, 100, 100, 0.3);
}
</style>
