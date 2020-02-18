import Vue from 'vue';
import Vuex from 'vuex';
import { MapViewer } from '@/components/Map';
import { MapViewGroup } from '@/components/Map';
import { TelemetryDataProvider } from './telemetry/telemetry';

Vue.use(Vuex);

const findView = (
  groups: MapViewGroup[],
  groupId: string,
  viewId: string
): MapViewer | undefined => {
  const group = groups.find(group => group.id === groupId);
  if (group) {
    return group.views.find(view => view.id === viewId);
  }
  return undefined;
};

export default new Vuex.Store({
  state: {
    viewGroups: [] as MapViewGroup[],
    activeGroup: null as MapViewGroup | null,
    nextViewGroupId: 1 as number,
    telemetryDataProvider: new TelemetryDataProvider(),
  },
  mutations: {
    setActiveGroup(state, group: any) {
      state.activeGroup = group;
    },
    addViewGroup(state, group) {
      state.viewGroups.push(group);
    },
  },
  actions: {
    async addViewGroup({ state, commit }) {
      const viewGroup = new MapViewGroup('view-group-' + state.nextViewGroupId++);
      //      commit("addViewGroup", viewGroup);
      state.viewGroups.push(viewGroup);
      if (!state.activeGroup) {
        commit('setActiveGroup', viewGroup);
      }
      return viewGroup;
    },
    async addView({ state, commit }, groupId?: string) {
      const group = state.activeGroup || state.viewGroups.find(group => group.id === groupId);
      return await group?.addView();
    },
  },
  getters: {
    focusedView: state => (groupId?: string): MapViewer | undefined => {
      const group = state.activeGroup || state.viewGroups.find(group => group.id === groupId);
      return group?.focusedView;
    },
    view: state => (groupId: string, viewId: string): MapViewer | undefined => {
      return findView(state.viewGroups, groupId, viewId);
    },
    views: state => state.activeGroup?.views,
    activeGroup: state => state.activeGroup,
  },
  modules: {},
});
