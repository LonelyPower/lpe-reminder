<script setup lang="ts">
import { computed } from "vue";

interface Props {
  mode: "idle" | "work" | "break";
  remainingMs: number;
  cycleCount: number;
  totalDurationMs?: number;
  isRunning?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "start"): void;
  (e: "pause"): void;
  (e: "reset"): void;
  (e: "skip-break"): void;
}>();

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const progress = computed(() => {
  const total = props.totalDurationMs ?? 0;
  if (!total) return 0;
  const done = total - props.remainingMs;
  return Math.min(100, Math.max(0, (done / total) * 100));
});

const primaryLabel = computed(() =>
  props.isRunning ? "暂停" : props.mode === "idle" ? "开始工作" : "继续"
);

const statusLabel = computed(() => {
  if (props.mode === "idle") return "空闲";
  if (props.mode === "work") return "工作中";
  return "休息中";
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
  <section class="timer-panel">
    <p class="subtitle">
      当前状态：
      <strong>{{ statusLabel }}</strong>
    </p>

    <div class="time-display">{{ formatTime(props.remainingMs) }}</div>

    <div class="progress-bar" aria-hidden="true">
      <div class="progress-inner" :style="{ width: `${progress}%` }" />
    </div>

    <p class="cycle">已完成轮次：{{ props.cycleCount }}</p>

    <div class="actions">
      <button type="button" class="primary" @click="onPrimaryClick">
        {{ primaryLabel }}
      </button>
      <button type="button" class="ghost" @click="emit('reset')">
        重置
      </button>
      <button
        v-if="props.mode === 'break'"
        type="button"
        class="ghost"
        @click="emit('skip-break')"
      >
        跳过
      </button>
    </div>
  </section>
</template>

<style scoped>
.timer-panel {
  max-width: 100%;
  margin: 0;
  padding: 32px 24px;
  border-radius: 24px;
  background: #FFFFFF;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  text-align: center;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.subtitle {
  font-size: 14px;
  color: #6B7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.subtitle strong {
  color: #059669;
}

.time-display {
  font-size: 64px;
  font-weight: 700;
  color: #1F2937;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 24px 0 32px;
}

.progress-bar {
  height: 8px;
  border-radius: 999px;
  background: #F3F4F6;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-inner {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: #059669;
  transition: width 0.2s linear;
}

.cycle {
  font-size: 13px;
  color: #9CA3AF;
  margin-bottom: 32px;
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

.primary {
  background: #059669;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
}

.primary:hover {
  background: #047857;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.3);
}

.primary:active {
  transform: translateY(0);
}

.ghost {
  background: #F3F4F6;
  color: #4B5563;
}

.ghost:hover {
  background: #E5E7EB;
  color: #1F2937;
}
</style>
