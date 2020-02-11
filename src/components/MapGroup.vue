<template>
  <div :id="activeGroup.id" class="map-group">
    <ul>
      <li v-for="view in activeGroup.views" :key="view.id">
        <map-view :view="view" :group="activeGroup.id"></map-view>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import Vuex, { mapGetters, mapActions } from "vuex";
import MapView from "./MapView.vue";

export default Vue.extend({
  name: "map-group",
  components: {
    MapView
  },
  data() {
    return {};
  },
  computed: {
    ...mapGetters(["view", "focusedView", "activeGroup"])
  },
  methods: {}
});
</script>

<style scoped>
.map-group {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}
.map-group ul {
  list-style: none;
  width: 100%;
  height: 25%;
}

.map-group ul li {
  border: 1px black solid;
  width: 100%;
  height: 100%;
}
</style>
