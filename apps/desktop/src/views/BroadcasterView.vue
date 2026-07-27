<script setup lang="ts">
import { convertFileSrc } from "@tauri-apps/api/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StatusBadge from "@/components/StatusBadge.vue";
import MetricStrip from "@/components/MetricStrip.vue";
import { tauriApi } from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";
import { useObsStore } from "@/stores/obsStore";
import { createRoomCode, listRoomParticipants } from "@/services/signaling";
import {
  registerCollabViewShortcuts,
  type ShortcutAction,
  unregisterCollabViewShortcuts
} from "@/services/shortcuts";

const app = useAppStore();
const obs = useObsStore();
const roomCode = ref("");
const hostToken = ref("");
const selectedScene = ref("");
const relayError = ref("");
const setupMessage = ref("");
const shortcutMessage = ref("");
const roomCodeMessage = ref("");
const roomCodeError = ref("");
const previewTick = ref(Date.now());
let previewTimer: ReturnType<typeof globalThis.setInterval> | undefined;

const participant = computed(() => app.selectedParticipant ?? app.participants[0]);
const resolution = computed(() => {
  const stats = participant.value?.stats;
  return stats && stats.width > 0 ? `${stats.width}x${stats.height}` : "-";
});
const previewUrl = computed(() => {
  if (!participant.value?.previewPath) return "";
  return `${convertFileSrc(participant.value.previewPath)}?t=${previewTick.value}`;
});

onMounted(async () => {
  await app.load();
  if (app.participants.length === 0) app.addLocalParticipant();
  await enableShortcuts();
  previewTimer = globalThis.setInterval(() => {
    previewTick.value = Date.now();
  }, 250);
});

onBeforeUnmount(() => {
  if (previewTimer) globalThis.clearInterval(previewTimer);
  void unregisterCollabViewShortcuts();
});

async function connectObs() {
  await obs.connect(app.settings.obs.host, app.settings.obs.port);
  selectedScene.value = obs.currentScene;
}

async function switchScene(sceneName: string) {
  selectedScene.value = sceneName;
  await obs.switchScene(sceneName);
}

async function switchSceneByAction(action: ShortcutAction) {
  const sceneName = sceneForAction(action);
  if (!sceneName) return;
  await switchScene(sceneName);
}

function sceneForAction(action: ShortcutAction): string {
  const setupScene = obs.setupResult?.scenes.find((scene) => scene.key === action)?.sceneName;
  if (setupScene) return setupScene;
  const fallback: Record<ShortcutAction, string> = {
    self: "CollabView - 自分視点",
    player1: "CollabView - Player 1",
    player2: "CollabView - Player 2",
    player3: "CollabView - Player 3",
    split2: "CollabView - 2分割",
    split4: "CollabView - 4分割"
  };
  return fallback[action];
}

async function enableShortcuts() {
  shortcutMessage.value = "";
  try {
    await registerCollabViewShortcuts(app.settings.shortcuts, (action) => {
      void switchSceneByAction(action);
    });
    shortcutMessage.value = "グローバルショートカット有効";
  } catch (error) {
    shortcutMessage.value = error instanceof Error ? error.message : String(error);
  }
}

async function startRelay() {
  if (!participant.value) return;
  relayError.value = "";
  participant.value.state = "connecting";
  try {
    const outputPort = participant.value.outputPort ?? participant.value.port + 1000;
    const session = await tauriApi.startSrtRelay({
      participantId: participant.value.id,
      listenPort: participant.value.port,
      outputPort,
      remoteInputUrl: participant.value.remoteInputUrl,
      latencyMs: 250
    });
    participant.value.srtUrl = session.inputUrl;
    participant.value.obsUrl = session.obsUrl;
    participant.value.previewPath = session.previewPath;
    participant.value.relayProcessId = session.processId;
    participant.value.outputPort = outputPort;
    participant.value.state = "connecting";
    previewTick.value = Date.now();
  } catch (error) {
    participant.value.state = "failed";
    relayError.value = error instanceof Error ? error.message : String(error);
  }
}

async function createJoinCode() {
  if (!participant.value) {
    app.addLocalParticipant();
  }
  const target = participant.value;
  if (!target) return;
  roomCodeError.value = "";
  roomCodeMessage.value = "";
  try {
    const result = await createRoomCode({
      signalingUrl: app.settings.signalingUrl,
      transportMode: app.settings.transportMode,
      hostAddress: app.settings.hostAddress,
      hostPort: target.port
    });
    roomCode.value = result.roomCode;
    hostToken.value = result.hostToken;
    roomCodeMessage.value = "参加者にはこのコードとシグナリングURLを伝えてください。";
    await app.save();
  } catch (error) {
    roomCodeError.value =
      error instanceof Error ? error.message : "参加コードの発行に失敗しました。";
  }
}

async function syncRelayParticipants() {
  if (!roomCode.value || !hostToken.value) {
    roomCodeError.value = "先に参加コードを発行してください。";
    return;
  }
  roomCodeError.value = "";
  try {
    const result = await listRoomParticipants(
      app.settings.signalingUrl,
      roomCode.value,
      hostToken.value
    );
    const syncedIds: string[] = [];
    for (const [index, item] of result.participants.entries()) {
      if (!item.relay) continue;
      syncedIds.push(item.participantId);
      const existing = app.participants.find(
        (participant) => participant.id === item.participantId
      );
      const outputPort = 13001 + index;
      if (existing) {
        existing.displayName = item.displayName;
        existing.srtUrl = item.relay.broadcasterPullUrl;
        existing.remoteInputUrl = item.relay.broadcasterPullUrl;
        existing.port = item.relay.egressPort;
        existing.outputPort = existing.outputPort ?? outputPort;
      } else {
        app.participants.push({
          id: item.participantId,
          displayName: item.displayName,
          state: "idle",
          srtUrl: item.relay.broadcasterPullUrl,
          remoteInputUrl: item.relay.broadcasterPullUrl,
          port: item.relay.egressPort,
          outputPort,
          stats: {
            fps: 0,
            bitrateKbps: 0,
            latencyMs: item.relay.latencyMs,
            packetLossPercent: 0,
            width: 0,
            height: 0,
            droppedFrames: 0
          }
        });
      }
    }
    if (syncedIds[0]) {
      app.selectedParticipantId = syncedIds[0];
    }
    roomCodeMessage.value = `${result.participants.length}人の参加情報を同期しました。`;
  } catch (error) {
    roomCodeError.value = error instanceof Error ? error.message : "参加者同期に失敗しました。";
  }
}

async function stopRelay() {
  if (!participant.value?.relayProcessId) return;
  const processId = participant.value.relayProcessId;
  try {
    await tauriApi.stopManagedProcess(processId);
    participant.value.state = "stopped";
    participant.value.relayProcessId = undefined;
  } catch (error) {
    relayError.value = error instanceof Error ? error.message : String(error);
  }
}

function markPreviewActive() {
  if (!participant.value) return;
  participant.value.state = "connected";
}

async function copyObsUrl() {
  const url = participant.value?.obsUrl ?? "";
  if (!url) return;
  await globalThis.navigator.clipboard.writeText(url);
}

async function setupObsScenes() {
  setupMessage.value = "";
  const setupParticipants = app.participants
    .filter((item) => item.obsUrl)
    .map((item) => ({
      displayName: item.displayName,
      obsUrl: item.obsUrl ?? ""
    }));
  if (setupParticipants.length === 0) {
    setupMessage.value = "先にSRT受信を開始してOBS追加用URLを生成してください。";
    return;
  }
  await obs.setupCollabViewScenes(setupParticipants, (name, kind) => {
    const label = kind === "scene" ? "シーン" : "ソース";
    const answer = globalThis.prompt(
      `${label}「${name}」は既に存在します。\n1: 既存項目を使用\n2: 別名で作成\nキャンセル: 中止`,
      "1"
    );
    if (answer === null) return "cancel";
    if (answer.trim() === "2") return "alias";
    return "use";
  });
  if (!obs.error) {
    setupMessage.value = "OBSシーンをセットアップしました。";
  }
}
</script>

<template>
  <main class="workspace">
    <aside class="side-panel">
      <RouterLink class="back-link" to="/"> ← 起動画面 </RouterLink>
      <h2>配信者モード</h2>

      <section class="panel-block">
        <label>ルームコード</label>
        <div class="room-code">
          {{ roomCode || "未発行" }}
        </div>
        <button class="secondary-button full" type="button" @click="createJoinCode">
          参加コードを発行
        </button>
        <button
          v-if="app.settings.transportMode === 'relay'"
          class="secondary-button full"
          type="button"
          @click="syncRelayParticipants"
        >
          relay参加者を同期
        </button>
        <p class="hint">
          {{ app.settings.transportMode === "relay" ? "インターネットrelay" : "LAN" }} /
          シグナリングURL: {{ app.settings.signalingUrl }}
        </p>
        <p v-if="roomCodeMessage" class="hint">{{ roomCodeMessage }}</p>
        <p v-if="roomCodeError" class="error-text">{{ roomCodeError }}</p>
      </section>

      <section class="panel-block">
        <div class="row-between">
          <label>OBS</label>
          <StatusBadge
            :state="
              obs.state === 'connected' ? 'connected' : obs.state === 'failed' ? 'failed' : 'idle'
            "
            :label="
              obs.state === 'connected' ? '接続済み' : obs.state === 'failed' ? 'エラー' : '未接続'
            "
          />
        </div>
        <button class="primary-button full" type="button" @click="connectObs">OBSへ接続</button>
        <p v-if="obs.error" class="error-text">
          {{ obs.error }}
        </p>
        <p v-if="obs.version" class="hint">
          OBS {{ obs.version }} / WebSocket {{ obs.websocketVersion }}
        </p>
        <button
          class="secondary-button full"
          type="button"
          :disabled="obs.state !== 'connected'"
          @click="setupObsScenes"
        >
          OBSへ自動セットアップ
        </button>
        <p v-if="setupMessage" class="hint">
          {{ setupMessage }}
        </p>
      </section>

      <section class="panel-block">
        <div class="row-between">
          <label>参加者</label>
          <button class="small-button" type="button" @click="app.addLocalParticipant">追加</button>
        </div>
        <button
          v-for="item in app.participants"
          :key="item.id"
          class="participant-row"
          :class="{ selected: item.id === app.selectedParticipantId }"
          type="button"
          @click="app.selectedParticipantId = item.id"
        >
          <span>{{ item.displayName }}</span>
          <StatusBadge :state="item.state" :label="item.state" />
        </button>
      </section>
    </aside>

    <section class="preview-area">
      <div class="preview-header">
        <div>
          <h2>{{ participant?.displayName ?? "参加者なし" }}</h2>
          <p>参加者送信先: {{ participant?.srtUrl ?? "SRT URL未割り当て" }}</p>
          <p>OBS追加用URL: {{ participant?.obsUrl ?? "受信開始後に生成されます" }}</p>
        </div>
        <button
          class="secondary-button"
          type="button"
          :disabled="!participant?.obsUrl"
          @click="copyObsUrl"
        >
          OBS追加用URLをコピー
        </button>
      </div>
      <img
        v-if="previewUrl"
        class="preview-frame"
        :src="previewUrl"
        :alt="`${participant?.displayName ?? 'Player'} preview`"
        @load="markPreviewActive"
      />
      <div v-else class="video-placeholder">
        <span>{{ participant?.displayName ?? "Player" }}</span>
        <small>接続を待っています...</small>
      </div>
      <p v-if="relayError" class="error-text">
        {{ relayError }}
      </p>
      <MetricStrip
        :fps="participant?.stats.fps ?? 0"
        :bitrate-kbps="participant?.stats.bitrateKbps ?? 0"
        :latency-ms="participant?.stats.latencyMs ?? 0"
        :packet-loss-percent="participant?.stats.packetLossPercent ?? 0"
        :resolution="resolution"
      />
    </section>

    <aside class="control-panel">
      <h2>視点切り替え</h2>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('self'))">
        自分視点
      </button>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('player1'))">
        Player 1
      </button>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('player2'))">
        Player 2
      </button>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('player3'))">
        Player 3
      </button>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('split2'))">
        2画面
      </button>
      <button class="scene-button" type="button" @click="switchScene(sceneForAction('split4'))">
        4画面
      </button>

      <section class="panel-block">
        <div class="row-between">
          <h3>ショートカット</h3>
          <button class="small-button" type="button" @click="enableShortcuts">再登録</button>
        </div>
        <p class="hint">
          {{ shortcutMessage || "Command+1〜6でOBSシーンを切り替えます。" }}
        </p>
      </section>

      <section class="panel-block">
        <h3>SRT受信</h3>
        <p class="hint">
          参加者は配信者MacのIPアドレスとポート {{ participant?.port ?? "-" }} へ送信します。
        </p>
        <p class="hint">
          OBSは {{ participant?.outputPort ?? "-" }} 番のローカルSRTをメディアソースとして読みます。
        </p>
        <div class="button-row">
          <button
            class="primary-button"
            type="button"
            :disabled="!participant || Boolean(participant.relayProcessId)"
            @click="startRelay"
          >
            受信開始
          </button>
          <button
            class="secondary-button"
            type="button"
            :disabled="!participant?.relayProcessId"
            @click="stopRelay"
          >
            受信停止
          </button>
        </div>
      </section>

      <section class="panel-block">
        <label for="scene">OBSシーン</label>
        <select id="scene" v-model="selectedScene" @change="switchScene(selectedScene)">
          <option value="">選択してください</option>
          <option v-for="scene in obs.scenes" :key="scene.sceneName" :value="scene.sceneName">
            {{ scene.sceneName }}
          </option>
        </select>
      </section>

      <section class="panel-block danger">
        <h3>緊急停止</h3>
        <button class="danger-button" type="button">全参加者映像を非表示</button>
      </section>
    </aside>
  </main>
</template>
