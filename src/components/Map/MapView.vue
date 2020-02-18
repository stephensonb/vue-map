<template>
  <div class="map-view-container">
    <div :id="view.id" class="map-view"></div>
    <div :id="infoDivId" class="esri-component toggle-widget esri-widget">
      <div
        class="esri-widget--button esri-widget esri-interactive"
        id="switch-btn"
        role="button"
        @click="toggleView"
      >
        {{ viewType }}
      </div>
      <div
        class="esri-widget--button esri-widget esri-interactive"
        id="syncBtn"
        role="button"
        @click="toggleSync"
      >
        <i class="material-icons">{{ syncIcon }}</i>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
  import Vue from 'vue';

  export default Vue.extend({
    name: 'map-2d',
    props: {
      view: {
        type: Object,
      },
    },
    data() {
      return {};
    },
    methods: {
      async toggleView() {
        await this.view.toggleView();
      },
      toggleSync() {
        this.view.toggleSync();
      },
    },
    computed: {
      viewType(): string {
        return this.view.viewType === '2D' ? '3D' : '2D';
      },
      syncIcon(): string {
        return this.view.sync ? 'lock' : 'lock_open';
      },
      infoDivId(): string {
        return this.view.id + '-info';
      },
    },
    watch: {
      view() {
        //this.view.activeView.container = this.view.id;
      },
    },
    mounted() {
      if (this.view.activeView) {
        this.view.activeView.container = this.view.id;
      }
    },
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
