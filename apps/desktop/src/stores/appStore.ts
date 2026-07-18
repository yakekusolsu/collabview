import { defineStore } from "pinia";
import type { CaptureSource, ParticipantSummary } from "@collabview/shared-types";
import { findQualityPreset } from "@/services/quality";
import { tauriApi, type AppSettings } from "@/services/tauri";

const defaultSettings: AppSettings = {
  displayName: "",
  obs: {
    host: "127.0.0.1",
    port: 4455,
    passwordConfigured: false,
    autoConnect: false,
    autoReconnect: true
  },
  selectedQualityId: "standard",
  hostAddress: "127.0.0.1",
  hostPort: 12000,
  autoQuality: true,
  audioMode: "none",
  shortcuts: {
    selfView: "Command+1",
    player1: "Command+2",
    player2: "Command+3",
    player3: "Command+4",
    split2: "Command+5",
    split4: "Command+6"
  }
};

export const useAppStore = defineStore("app", {
  state: () => ({
    settings: defaultSettings,
    sources: [] as CaptureSource[],
    participants: [] as ParticipantSummary[],
    selectedParticipantId: "",
    logs: [] as string[],
    errorMessage: ""
  }),
  getters: {
    selectedQuality: (state) => findQualityPreset(state.settings.selectedQualityId),
    selectedParticipant: (state) =>
      state.participants.find((participant) => participant.id === state.selectedParticipantId)
  },
  actions: {
    async load() {
      try {
        const loaded = await tauriApi.loadSettings();
        this.settings = {
          ...defaultSettings,
          ...loaded,
          obs: { ...defaultSettings.obs, ...loaded.obs },
          shortcuts: { ...defaultSettings.shortcuts, ...loaded.shortcuts }
        };
      } catch {
        this.settings = defaultSettings;
      }
    },
    async save() {
      await tauriApi.saveSettings(this.settings);
    },
    async refreshSources() {
      this.sources = await tauriApi.listCaptureSources();
    },
    addLocalParticipant() {
      const port = 12001 + this.participants.length;
      const outputPort = 13001 + this.participants.length;
      const id = crypto.randomUUID();
      this.participants.push({
        id,
        displayName: `Player ${this.participants.length + 1}`,
        state: "idle",
        port,
        srtUrl: `srt://127.0.0.1:${port}?mode=listener&latency=250000`,
        outputPort,
        stats: {
          fps: 0,
          bitrateKbps: 0,
          latencyMs: 0,
          packetLossPercent: 0,
          width: 0,
          height: 0,
          droppedFrames: 0
        }
      });
      this.selectedParticipantId = id;
    },
    async refreshLogs() {
      this.logs = await tauriApi.getRuntimeLogs();
    }
  }
});
