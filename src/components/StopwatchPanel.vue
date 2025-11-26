<script setup lang="ts">
import { computed, defineProps, defineEmits } from "vue";

interface Props {
  elapsedMs: number;
  isRunning: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "start"): void;
  (e: "pause"): void;
  (e: "stop"): void;
}>();

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const primaryLabel = computed(() =>
  props.isRunning ? "暂停" : props.elapsedMs === 0 ? "开始计时" : "继续"
);

const statusLabel = computed(() => {
  if (props.elapsedMs === 0 && !props.isRunning) return "空闲";
  if (props.isRunning) return "计时中";
  return "已暂停";
});

function onPrimaryClick() {
  if (props.isRunning) {
    emit("pause");
  } else {
    emit("start");
  }
}
</script>

<template>
  <section class="stopwatch-panel">
    <h1 class="title">正计时器</h1>
    <p class="subtitle">
      当前状态：
      <strong>{{ statusLabel }}</strong>
    </p>

    <div class="time-display">{{ formatTime(props.elapsedMs) }}</div>

    <div class="actions">
      <button type="button" class="primary" @click="onPrimaryClick">
        {{ primaryLabel }}
      </button>
      <button 
        type="button" 
        class="ghost" 
        @click="emit('stop')"
        :disabled="props.elapsedMs === 0"
      >
        结束
      </button>
    </div>
  </section>
</template>

<style scoped>
.stopwatch-panel {
  max-width: 420px;
  margin: 40px auto;
  padding: 24px 20px 20px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
  text-align: center;
}

.title {
  font-size: 24px;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.time-display {
  font-size: 40px;
  letter-spacing: 0.08em;
  margin-bottom: 24px;
  color: #10b981;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.actions button {
  min-width: 88px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  background: #10b981;
  color: #ffffff;
  border-color: #059669;
}

.primary:hover:not(:disabled) {
  background: #059669;
}

.ghost {
  background: #ffffff;
  color: #374151;
  border-color: #d1d5db;
}

.ghost:hover:not(:disabled) {
  background: #f3f4f6;
}
</style>
