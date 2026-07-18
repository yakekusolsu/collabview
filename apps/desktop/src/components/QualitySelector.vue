<script setup lang="ts">
import type { QualityPreset } from "@collabview/shared-types";
import { qualityPresets } from "@/services/quality";

const selected = defineModel<QualityPreset["id"]>({ required: true });
</script>

<template>
  <div class="quality-grid" aria-label="品質プリセット">
    <button
      v-for="preset in qualityPresets"
      :key="preset.id"
      class="quality-option"
      :class="{ selected: selected === preset.id }"
      type="button"
      @click="selected = preset.id"
    >
      <strong>{{ preset.label }}</strong>
      <span>{{ preset.width }}x{{ preset.height }} / {{ preset.fps }}fps</span>
      <span>{{ preset.bitrateKbps / 1000 }}Mbps · {{ preset.encoder }}</span>
    </button>
  </div>
</template>
