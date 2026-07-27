<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import { RouterLink } from "vue-router";
import QualitySelector from "@/components/QualitySelector.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import MetricStrip from "@/components/MetricStrip.vue";
import { useAppStore } from "@/stores/appStore";
import { tauriApi } from "@/services/tauri";
import { joinRoomCode, parseSrtUrlEndpoint } from "@/services/signaling";
import { describeObsError, ObsClient, type ObsScene } from "@/services/obsClient";

const app = useAppStore();
const selectedSourceId = ref("");
const shareMode = ref<"screen" | "obs">("screen");
const state = ref<"idle" | "connecting" | "connected" | "failed" | "stopped">("idle");
const participantObsState = ref<"idle" | "connecting" | "connected" | "failed">("idle");
const participantObsError = ref("");
const participantObsVersion = ref("");
const participantObsScenes = ref<ObsScene[]>([]);
const participantObsCurrentScene = ref("");
const obsIngestPort = ref(15001);
const activeProcessId = ref("");
const ffmpegArgs = ref<string[]>([]);
const error = ref("");
const joinCode = ref("");
const joinMessage = ref("");
const remoteOutputUrl = ref("");
const previewFramePath = ref("");
const previewFrameSrc = computed(() =>
  previewFramePath.value ? convertFileSrc(previewFramePath.value) : ""
);

const selectedSource = computed(() =>
  app.sources.find((source) => source.id === selectedSourceId.value)
);
const obsIngestUrl = computed(
  () =>
    `srt://127.0.0.1:${obsIngestPort.value}?mode=caller&latency=${app.selectedQuality.latencyMs * 1000}&transtype=live`
);
const participantObsClient = new ObsClient();

onMounted(async () => {
  await app.load();
  try {
    await app.refreshSources();
    selectedSourceId.value = app.sources[0]?.id ?? "";
  } catch (caught) {
    error.value =
      caught instanceof Error
        ? caught.message
        : "画面収録権限がないため、共有対象を取得できませんでした。";
  }
});

async function startSending() {
  if (!remoteOutputUrl.value) {
    error.value = "先に参加コードからrelay接続先を取得してください。";
    return;
  }
  if (shareMode.value === "screen" && !selectedSource.value) {
    error.value = "共有する画面またはウィンドウを選択してください。";
    return;
  }
  state.value = "connecting";
  error.value = "";
  try {
    if (shareMode.value === "obs") {
      const session = await tauriApi.startObsIngestForward({
        listenPort: obsIngestPort.value,
        remoteOutputUrl: remoteOutputUrl.value,
        latencyMs: app.selectedQuality.latencyMs
      });
      activeProcessId.value = session.processId;
      state.value = "connected";
      return;
    }

    if (!selectedSource.value) {
      throw new Error("共有する画面またはウィンドウを選択してください。");
    }
    const request = {
      role: "sender" as const,
      sourceId: selectedSource.value.id,
      destinationHost: app.settings.hostAddress,
      destinationPort: app.settings.hostPort,
      remoteOutputUrl: remoteOutputUrl.value || undefined,
      quality: app.selectedQuality
    };
    ffmpegArgs.value = await tauriApi.buildFfmpegArgs(request);
    await tauriApi.startManagedFfmpeg({ id: "participant-sender", args: request });
    activeProcessId.value = "participant-sender";
    state.value = "connected";
  } catch (caught) {
    state.value = "failed";
    error.value = caught instanceof Error ? caught.message : "送信開始に失敗しました。";
  }
}

async function resolveJoinCode() {
  error.value = "";
  joinMessage.value = "";
  try {
    const result = await joinRoomCode({
      signalingUrl: app.settings.signalingUrl,
      roomCode: joinCode.value,
      displayName: app.settings.displayName || "Player"
    });
    if (result.transportMode === "relay") {
      if (!result.participantPublishUrl) throw new Error("relay送信URLが返されませんでした。");
      const endpoint = parseSrtUrlEndpoint(result.participantPublishUrl);
      remoteOutputUrl.value = result.participantPublishUrl;
      app.settings.hostAddress = endpoint.host;
      app.settings.hostPort = endpoint.port;
      joinMessage.value = `relay接続先を取得しました: ${endpoint.host}:${endpoint.port}`;
    } else {
      remoteOutputUrl.value = "";
      app.settings.hostAddress = result.hostAddress;
      app.settings.hostPort = result.hostPort;
      joinMessage.value = `接続先を取得しました: ${result.hostAddress}:${result.hostPort}`;
    }
    await app.save();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "参加コードの解決に失敗しました。";
  }
}

async function stopSending() {
  const processId = activeProcessId.value || "participant-sender";
  await tauriApi.stopManagedProcess(processId);
  activeProcessId.value = "";
  state.value = "stopped";
}

async function connectParticipantObs() {
  participantObsState.value = "connecting";
  participantObsError.value = "";
  try {
    const password = await tauriApi.loadObsPassword();
    const result = await participantObsClient.connect(
      app.settings.obs.host,
      app.settings.obs.port,
      password ?? undefined
    );
    participantObsVersion.value = result.obsVersion;
    participantObsScenes.value = await participantObsClient.getScenes();
    participantObsCurrentScene.value = await participantObsClient.getCurrentProgramScene();
    participantObsState.value = "connected";
  } catch (caught) {
    participantObsState.value = "failed";
    participantObsError.value = describeObsError(caught);
  }
}

async function copyObsIngestUrl() {
  await globalThis.navigator.clipboard.writeText(obsIngestUrl.value);
}

async function capturePreviewFrame() {
  if (!selectedSource.value) {
    error.value = "共有する画面またはウィンドウを選択してください。";
    return;
  }
  error.value = "";
  try {
    const frame = await tauriApi.captureFrame({
      sourceId: selectedSource.value.id,
      width: app.selectedQuality.width,
      height: app.selectedQuality.height,
      fps: app.selectedQuality.fps,
      showsCursor: true,
      timeoutMs: 3000
    });
    previewFramePath.value = frame.path;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "プレビュー取得に失敗しました。";
  }
}
</script>

<template>
  <main class="participant-shell">
    <header class="top-bar">
      <RouterLink class="back-link" to="/"> ← 起動画面 </RouterLink>
      <h1>参加者モード</h1>
      <StatusBadge :state="state" :label="state" />
    </header>

    <section class="participant-grid">
      <div class="form-panel">
        <label for="join-code">参加コード</label>
        <div class="inline-fields">
          <input id="join-code" v-model="joinCode" maxlength="6" placeholder="ABC234" />
          <button class="secondary-button" type="button" @click="resolveJoinCode">
            接続先を取得
          </button>
        </div>
        <p class="hint">
          シグナリングURL: {{ app.settings.signalingUrl }}。設定画面で変更できます。
        </p>
        <p v-if="joinMessage" class="success-text">{{ joinMessage }}</p>
        <p v-if="remoteOutputUrl" class="hint">
          送信先はrelayサーバーです。配信者MacのIPへ直接接続しません。
        </p>

        <label for="room">手動接続: 配信者IPまたはホスト</label>
        <input id="room" v-model="app.settings.hostAddress" placeholder="192.168.0.10" />

        <label for="port">手動接続: ポート</label>
        <input id="port" v-model.number="app.settings.hostPort" type="number" min="1" max="65535" />

        <label for="name">表示名</label>
        <input id="name" v-model="app.settings.displayName" maxlength="32" placeholder="Player 1" />

        <label for="share-mode">共有方法</label>
        <select id="share-mode" v-model="shareMode">
          <option value="screen">画面/ウィンドウを直接共有</option>
          <option value="obs">参加者OBSから受け取る</option>
        </select>

        <label v-if="shareMode === 'screen'" for="source">共有対象</label>
        <select v-if="shareMode === 'screen'" id="source" v-model="selectedSourceId">
          <option v-for="source in app.sources" :key="source.id" :value="source.id">
            {{ source.kind }} · {{ source.name }}
          </option>
        </select>

        <section v-if="shareMode === 'obs'" class="notice">
          <div class="row-between">
            <strong>参加者OBS</strong>
            <StatusBadge
              :state="
                participantObsState === 'connected'
                  ? 'connected'
                  : participantObsState === 'failed'
                    ? 'failed'
                    : 'idle'
              "
              :label="
                participantObsState === 'connected'
                  ? '接続済み'
                  : participantObsState === 'failed'
                    ? 'エラー'
                    : '未接続'
              "
            />
          </div>
          <button class="secondary-button full" type="button" @click="connectParticipantObs">
            OBS WebSocketへ接続
          </button>
          <p v-if="participantObsVersion" class="hint">OBS {{ participantObsVersion }}</p>
          <p v-if="participantObsCurrentScene" class="hint">
            現在のOBSシーン: {{ participantObsCurrentScene }}
          </p>
          <p v-if="participantObsScenes.length > 0" class="hint">
            取得したOBSシーン数: {{ participantObsScenes.length }}
          </p>
          <label for="obs-ingest-port">OBSからCollabViewへ送るポート</label>
          <input
            id="obs-ingest-port"
            v-model.number="obsIngestPort"
            type="number"
            min="1"
            max="65535"
          />
          <p class="hint">OBSのSRT出力先にこのURLを設定してください。</p>
          <div class="inline-fields">
            <input :value="obsIngestUrl" readonly />
            <button class="secondary-button" type="button" @click="copyObsIngestUrl">コピー</button>
          </div>
          <p v-if="participantObsError" class="error-text">{{ participantObsError }}</p>
        </section>

        <div v-if="shareMode === 'screen'" class="notice">
          CollabViewがゲーム画面を共有するには、macOSの画面収録権限が必要です。通知や個人情報が映らない共有対象を選んでください。
        </div>

        <label>音声</label>
        <select v-model="app.settings.audioMode">
          <option value="none">全音声無効</option>
          <option value="game">ゲーム音</option>
          <option value="system">システム音</option>
          <option value="microphone">マイク音</option>
        </select>
        <p class="hint">
          初期設定ではマイク音声を送信しません。Discord通話と二重音声になる場合があります。
        </p>
      </div>

      <div class="preview-area">
        <div v-if="!previewFramePath" class="video-placeholder">
          <span>{{ selectedSource?.name ?? "共有対象未選択" }}</span>
          <small>ローカルプレビュー</small>
        </div>
        <img v-else class="preview-frame" :src="previewFrameSrc" alt="ローカルプレビュー" />
        <MetricStrip
          :fps="0"
          :bitrate-kbps="0"
          :latency-ms="app.selectedQuality.latencyMs"
          :packet-loss-percent="0"
          :resolution="`${app.selectedQuality.width}x${app.selectedQuality.height}`"
        />
      </div>

      <div class="control-panel">
        <h2>品質</h2>
        <QualitySelector v-model="app.settings.selectedQualityId" />
        <button class="secondary-button full" type="button" @click="capturePreviewFrame">
          プレビューを更新
        </button>
        <button class="primary-button full" type="button" @click="startSending">
          {{ shareMode === "obs" ? "OBS入力転送開始" : "送信開始" }}
        </button>
        <button class="secondary-button full" type="button" @click="stopSending">送信停止</button>
        <p v-if="error" class="error-text">
          {{ error }}
        </p>
        <details v-if="ffmpegArgs.length > 0">
          <summary>生成されたFFmpeg引数</summary>
          <pre>{{ ffmpegArgs.join(" ") }}</pre>
        </details>
      </div>
    </section>
  </main>
</template>
