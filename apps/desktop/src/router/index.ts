import { createRouter, createWebHashHistory } from "vue-router";
import StartView from "@/views/StartView.vue";
import BroadcasterView from "@/views/BroadcasterView.vue";
import ParticipantView from "@/views/ParticipantView.vue";
import SettingsView from "@/views/SettingsView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "start", component: StartView },
    { path: "/broadcaster", name: "broadcaster", component: BroadcasterView },
    { path: "/participant", name: "participant", component: ParticipantView },
    { path: "/settings", name: "settings", component: SettingsView }
  ]
});
