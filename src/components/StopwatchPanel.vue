<script setup lang="ts">
import { computed } from "vue";

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
  max-width: 100%;
  margin: 0;
  padding: 32px 24px;
  border-radius: 24px;
  background: var(--bg-card);
  box-shadow: 0 4px 20px var(--shadow-color);
  text-align: center;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  transition: background-color 0.3s, box-shadow 0.3s;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.subtitle strong {
  color: var(--primary-color);
}

.time-display {
  font-size: 64px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 24px 0 48px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.actions button {
  min-width: 96px;
  padding: 10px 20px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  background: var(--primary-color);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
}

.primary:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.3);
}

.primary:active {
  transform: translateY(0);
}

.ghost {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
