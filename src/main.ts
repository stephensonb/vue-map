/// <reference types="arcgis-js-api" />
import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
//import "./arcgis.config"; /

Vue.config.productionTip = false;

// for testing
store.dispatch("addViewGroup").then(async group => {
  await store.dispatch("addView", group.id);
  await store.dispatch("addView", group.id);
  await store.dispatch("addView", group.id);
  await store.dispatch("addView", group.id);
});

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount("#app");
