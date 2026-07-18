<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import { RouterLink } from "vue-router";
import QualitySelector from "@/components/QualitySelector.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import MetricStrip from "@/components/MetricStrip.vue";
import { useAppStore } from "@/stores/appStore";
import { tauriApi } from "@/services/tauri";

const app = useAppStore();
const selectedSourceId = ref("");
const state = ref<"idle" | "connecting" | "connected" | "failed" | "stopped">("idle");
const ffmpegArgs = ref<string[]>([]);
const error = ref("");
const previewFramePath = ref("");
const previewFrameSrc = computed(() =>
  previewFramePath.value ? convertFileSrc(previewFramePath.value) : ""
);

const selectedSource = computed(() =>
  app.sources.find((source) => source.id === selectedSourceId.value)
);

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
  if (!selectedSource.value) {
    error.value = "共有する画面またはウィンドウを選択してください。";
    return;
  }
  state.value = "connecting";
  error.value = "";
  try {
    const request = {
      role: "sender" as const,
      sourceId: selectedSource.value.id,
      destinationHost: app.settings.hostAddress,
      destinationPort: app.settings.hostPort,
      quality: app.selectedQuality
    };
    ffmpegArgs.value = await tauriApi.buildFfmpegArgs(request);
    await tauriApi.startManagedFfmpeg({ id: "participant-sender", args: request });
    state.value = "connected";
  } catch (caught) {
    state.value = "failed";
    error.value = caught instanceof Error ? caught.message : "送信開始に失敗しました。";
  }
}

async function stopSending() {
  await tauriApi.stopManagedProcess("participant-sender");
  state.value = "stopped";
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
        <label for="room">配信者IPまたはホスト</label>
        <input id="room" v-model="app.settings.hostAddress" placeholder="192.168.0.10" />

        <label for="port">ポート</label>
        <input id="port" v-model.number="app.settings.hostPort" type="number" min="1" max="65535" />

        <label for="name">表示名</label>
        <input id="name" v-model="app.settings.displayName" maxlength="32" placeholder="Player 1" />

        <label for="source">共有対象</label>
        <select id="source" v-model="selectedSourceId">
          <option v-for="source in app.sources" :key="source.id" :value="source.id">
            {{ source.kind }} · {{ source.name }}
          </option>
        </select>

        <div class="notice">
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
        <button class="primary-button full" type="button" @click="startSending">送信開始</button>
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
