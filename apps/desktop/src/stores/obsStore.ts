import { defineStore } from "pinia";
import {
  describeObsError,
  ObsClient,
  type ObsConflictChoice,
  type ObsScene,
  type ObsSetupParticipant,
  type ObsSetupResult
} from "@/services/obsClient";
import { tauriApi } from "@/services/tauri";

const client = new ObsClient();

export const useObsStore = defineStore("obs", {
  state: () => ({
    state: "idle" as "idle" | "connecting" | "connected" | "failed",
    scenes: [] as ObsScene[],
    currentScene: "",
    version: "",
    websocketVersion: "",
    setupResult: null as ObsSetupResult | null,
    error: ""
  }),
  actions: {
    async connect(host: string, port: number) {
      this.state = "connecting";
      this.error = "";
      try {
        const password = await tauriApi.loadObsPassword();
        const result = await client.connect(host, port, password ?? undefined);
        this.version = result.obsVersion;
        this.websocketVersion = result.obsWebSocketVersion;
        this.scenes = await client.getScenes();
        this.currentScene = await client.getCurrentProgramScene();
        this.state = "connected";
      } catch (error) {
        this.state = "failed";
        this.error = describeObsError(error);
      }
    },
    async switchScene(sceneName: string) {
      if (this.state !== "connected") return;
      await client.setCurrentProgramScene(sceneName);
      this.currentScene = sceneName;
    },
    async setupCollabViewScenes(
      participants: ObsSetupParticipant[],
      resolveConflict: (name: string, kind: "scene" | "input") => ObsConflictChoice
    ) {
      if (this.state !== "connected") {
        this.error = "OBSへ接続してから自動セットアップしてください。";
        return;
      }
      try {
        this.setupResult = await client.setupCollabViewScenes(participants, resolveConflict);
        this.scenes = await client.getScenes();
        this.error = "";
      } catch (error) {
        this.error = describeObsError(error);
      }
    },
    disconnect() {
      client.disconnect();
      this.state = "idle";
      this.scenes = [];
    }
  }
});
