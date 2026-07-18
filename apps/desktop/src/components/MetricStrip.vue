<script setup lang="ts">
defineProps<{
  fps: number;
  bitrateKbps: number;
  latencyMs: number;
  packetLossPercent: number;
  resolution: string;
}>();
</script>

<template>
  <div class="metric-strip">
    <div>
      <strong>{{ fps }}</strong>
      <span>FPS</span>
    </div>
    <div>
      <strong>{{ bitrateKbps }}</strong>
      <span>kbps</span>
    </div>
    <div>
      <strong>{{ latencyMs }}</strong>
      <span>ms</span>
    </div>
    <div>
      <strong>{{ packetLossPercent.toFixed(1) }}</strong>
      <span>% loss</span>
    </div>
    <div>
      <strong>{{ resolution }}</strong>
      <span>解像度</span>
    </div>
  </div>
</template>
