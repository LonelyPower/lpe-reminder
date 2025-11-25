<script setup lang="ts">
import { defineProps } from "vue";

interface Props {
  mode: "idle" | "work" | "break";
  remainingMs: number;
  cycleCount: number;
}

const props = defineProps<Props>();

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
</script>

<template>
  <section class="timer-panel">
    <h1 class="title">护眼定时器</h1>
    <p class="subtitle">
      当前状态：
      <strong>
        <span v-if="props.mode === 'idle'">空闲</span>
        <span v-else-if="props.mode === 'work'">工作中</span>
        <span v-else>休息中</span>
      </strong>
    </p>

    <div class="time-display">{{ formatTime(props.remainingMs) }}</div>

    <p class="cycle">已完成轮次：{{ props.cycleCount }}</p>

    <!-- 按钮等交互后续由上层容器决定，这里阶段0先展示状态 -->
  </section>
</template>

<style scoped>
.timer-panel {
  max-width: 420px;
  margin: 40px auto;
  padding: 24px 20px;
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

.cycle {
  font-size: 13px;
  color: #888;
}
</style>
