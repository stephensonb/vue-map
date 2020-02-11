<template>
  <div></div>
</template>

<script lang="ts">
import Vue from "vue";
import { loadModules } from "esri-loader";
import ArcGISMap from "esri/Map";
import SceneView from "esri/views/SceneView";

export default Vue.extend({
  name: "map-3d",
  data() {
    return {
      view: null as SceneView | null
    };
  },
  mounted() {
    loadModules(["esri/Map", "esri/views/SceneView"], { css: true }).then(
      ([ArcGISMap, SceneView]) => {
        const map: ArcGISMap = new ArcGISMap({
          basemap: "hybrid",
          ground: "world-elevation"
        });
        this.view = new SceneView({
          container: this.$el as HTMLDivElement,
          map: map,
          center: [-97.0788, 33.0317],
          zoom: 13
        });
      }
    );
  },
  beforeDestroy() {
    // destroy the map view
    if (this.view) {
      /// @ts-ignore: ignore strict null checking
      this.view.container = null;
    }
  }
});
</script>

<style scoped>
div {
  padding: 0;
  margin: 0;
  width: 500px;
  height: 500px;
}
</style>
