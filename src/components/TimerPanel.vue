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
    <h1 class="title">护眼定时器</h1>
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
        跳过本次休息
      </button>
    </div>
  </section>
</template>

<style scoped>
.timer-panel {
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
  margin-bottom: 12px;
}

.progress-bar {
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-inner {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #4ade80);
  transition: width 0.2s linear;
}

.cycle {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
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
}

.primary {
  background: #38bdf8;
  color: #ffffff;
  border-color: #0ea5e9;
}

.primary:hover {
  background: #0ea5e9;
}

.ghost {
  background: #ffffff;
  color: #374151;
  border-color: #d1d5db;
}

.ghost:hover {
  background: #f3f4f6;
}
</style>
