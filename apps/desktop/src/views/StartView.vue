<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";

const router = useRouter();
const app = useAppStore();

onMounted(() => {
  void app.load();
});
</script>

<template>
  <main class="start-shell">
    <section class="start-hero">
      <div class="logo-mark">CV</div>
      <h1>CollabView</h1>
      <p>低遅延でコラボ参加者のゲーム視点を受け取り、OBSの表示をすばやく切り替えます。</p>
      <div class="start-actions">
        <button class="primary-button" type="button" @click="router.push('/broadcaster')">
          配信者として開始
        </button>
        <button class="secondary-button" type="button" @click="router.push('/participant')">
          参加者として開始
        </button>
        <button class="ghost-button" type="button" @click="router.push('/settings')">設定</button>
      </div>
    </section>
    <footer class="app-footer">
      <span>v0.1.0</span>
      <span>macOS 12.3+ / Apple Silicon優先</span>
      <button class="link-button" type="button">更新確認</button>
    </footer>
  </main>
</template>
