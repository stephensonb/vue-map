/// <reference types="arcgis-js-api" />
import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import { Simulator } from '@/store/telemetry/simulator';
//import "./arcgis.config"; /

Vue.config.productionTip = false;

// for testing
store.dispatch('addViewGroup').then(async group => {
  await store.dispatch('addView', group.id);
  await store.dispatch('addView', group.id);
});

const sim = new Simulator(10000);
sim.start(15000, 1000);

new Vue({
  router,
  store,
  render: h => h(App),
}).$mount('#app');
