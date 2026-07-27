<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { tauriApi } from "@/services/tauri";

const app = useAppStore();
const password = ref("");
const saved = ref(false);

onMounted(() => {
  void app.load();
});

async function save() {
  await app.save();
  if (password.value.length > 0) {
    await tauriApi.saveObsPassword(password.value);
    app.settings.obs.passwordConfigured = true;
    password.value = "";
  }
  saved.value = true;
}
</script>

<template>
  <main class="settings-shell">
    <RouterLink class="back-link" to="/"> ← 起動画面 </RouterLink>
    <h1>設定</h1>

    <section class="settings-grid">
      <div class="form-panel">
        <h2>OBS接続</h2>
        <label for="obs-host">ホスト</label>
        <input id="obs-host" v-model="app.settings.obs.host" />
        <label for="obs-port">ポート</label>
        <input id="obs-port" v-model.number="app.settings.obs.port" type="number" />
        <label for="obs-password">パスワード</label>
        <input id="obs-password" v-model="password" type="password" autocomplete="off" />
        <label class="check-row">
          <input v-model="app.settings.obs.autoReconnect" type="checkbox" />
          OBS切断時に自動再接続
        </label>
      </div>

      <div class="form-panel">
        <h2>参加コード</h2>
        <label for="transport-mode">接続方式</label>
        <select id="transport-mode" v-model="app.settings.transportMode">
          <option value="lan">同一LAN</option>
          <option value="relay">インターネットrelay</option>
        </select>
        <label for="signaling-url">シグナリングサーバーURL</label>
        <input
          id="signaling-url"
          v-model="app.settings.signalingUrl"
          placeholder="http://127.0.0.1:8787"
        />
        <label for="host-address">配信者LANアドレス</label>
        <input id="host-address" v-model="app.settings.hostAddress" placeholder="192.168.0.10" />
        <label for="host-port">手動接続用ポート</label>
        <input
          id="host-port"
          v-model.number="app.settings.hostPort"
          type="number"
          min="1"
          max="65535"
        />
        <p class="hint">参加コードには、選択中の参加者用SRTポートとこのLANアドレスを登録します。</p>
        <p class="hint">
          インターネットrelayでは、シグナリングサーバー側の
          COLLABVIEW_RELAY_PUBLIC_HOST設定を使って中継URLを発行します。
        </p>
      </div>

      <div class="form-panel">
        <h2>macOS権限</h2>
        <p>
          システム設定 → プライバシーとセキュリティ → 画面収録とシステムオーディオ録音 →
          CollabViewを許可
        </p>
        <p class="hint">権限変更後はアプリの再起動が必要になる場合があります。</p>
      </div>

      <div class="form-panel">
        <h2>グローバルショートカット</h2>
        <label for="shortcut-self">自分視点</label>
        <input id="shortcut-self" v-model="app.settings.shortcuts.selfView" />
        <label for="shortcut-player1">Player 1</label>
        <input id="shortcut-player1" v-model="app.settings.shortcuts.player1" />
        <label for="shortcut-player2">Player 2</label>
        <input id="shortcut-player2" v-model="app.settings.shortcuts.player2" />
        <label for="shortcut-player3">Player 3</label>
        <input id="shortcut-player3" v-model="app.settings.shortcuts.player3" />
        <label for="shortcut-split2">2分割</label>
        <input id="shortcut-split2" v-model="app.settings.shortcuts.split2" />
        <label for="shortcut-split4">4分割</label>
        <input id="shortcut-split4" v-model="app.settings.shortcuts.split4" />
      </div>
    </section>

    <button class="primary-button" type="button" @click="save">保存</button>
    <p v-if="saved" class="success-text">保存しました。</p>
  </main>
</template>
