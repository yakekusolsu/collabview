<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  state: "idle" | "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "stopped";
  label: string;
}>();

const className = computed(() => `status status-${props.state}`);
</script>

<template>
  <span :class="className">{{ label }}</span>
</template>
