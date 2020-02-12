import Vue from "vue";
import Vuex from "vuex";
import { FMMapView } from "./FMMapView";
import { FMViewGroup } from "./FMViewGroup";

Vue.use(Vuex);

const findView = (
  groups: FMViewGroup[],
  groupId: string,
  viewId: string
): FMMapView | undefined => {
  const group = groups.find(group => group.id === groupId);
  if (group) {
    return group.views.find(view => view.id === viewId);
  }
  return undefined;
};

export default new Vuex.Store({
  state: {
    viewGroups: [] as FMViewGroup[],
    activeGroup: null as FMViewGroup | null,
    nextViewGroupId: 1 as number
  },
  mutations: {
    setActiveGroup(state, group: any) {
      state.activeGroup = group;
    },
    addViewGroup(state, group) {
      state.viewGroups.push(group);
    }
  },
  actions: {
    async addViewGroup({ state, commit }) {
      const viewGroup = new FMViewGroup(
        "view-group-" + state.nextViewGroupId++
      );
      //      commit("addViewGroup", viewGroup);
      state.viewGroups.push(viewGroup);
      if (!state.activeGroup) {
        commit("setActiveGroup", viewGroup);
      }
      return viewGroup;
    },
    async addView({ state, commit }, groupId?: string) {
      const group =
        state.activeGroup ||
        state.viewGroups.find(group => group.id === groupId);
      return await group?.addView();
    }
  },
  getters: {
    focusedView: state => (groupId?: string): FMMapView | undefined => {
      const group =
        state.activeGroup ||
        state.viewGroups.find(group => group.id === groupId);
      return group?.focusedView;
    },
    view: state => (groupId: string, viewId: string): FMMapView | undefined => {
      return findView(state.viewGroups, groupId, viewId);
    },
    views: state => state.activeGroup?.views,
    activeGroup: state => state.activeGroup
  },
  modules: {}
});
