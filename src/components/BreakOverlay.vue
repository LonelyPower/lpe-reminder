<script setup lang="ts">
import { computed } from "vue";

interface Props {
  visible: boolean;
  elapsedMs: number; // 已过时长(毫秒)
  targetMs: number; // 目标时长(毫秒)
  isCountdown?: boolean; // 是否为倒计时模式（显示护眼提示）
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "end"): void;
}>();

// 计算是否超时
const isOvertime = computed(() => {
  return props.elapsedMs > props.targetMs;
});

// 格式化时间显示
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 计算进度百分比
function getProgress(elapsed: number, target: number): number {
  if (target === 0) return 0;
  return Math.min((elapsed / target) * 100, 100);
}
</script>

<template>
  <teleport to="body">
    <Transition name="overlay-fade">
      <div v-if="visible" class="overlay">
        <div class="overlay-content">
          <div class="icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>

          <h1 class="title">休息时间</h1>
          
          <div class="timer-display">
            <div class="time">{{ formatTime(elapsedMs) }}</div>
            <div class="target">/ {{ formatTime(targetMs) }}</div>
          </div>

          <!-- 护眼提示（仅倒计时模式显示） -->
          <p  class="eye-tips">
            💡 闭目轻轻转动眼球，缓解干涩与疲劳
          </p>

          <div v-if="!isOvertime" class="progress-bar">
            <div class="progress-fill" :style="{ width: getProgress(elapsedMs, targetMs) + '%' }"></div>
          </div>

          <div v-if="isOvertime" class="overtime-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>已超过建议休息时长</span>
          </div>

          <div class="actions">
            <button type="button" class="btn btn-primary" @click="emit('end')">
              结束休息
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.overlay-content {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  margin-bottom: 32px;
  animation: pulse 2s ease-in-out infinite;
}

.icon-wrapper svg {
  color: #ffffff;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.title {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 24px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.timer-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.time {
  font-size: 64px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.target {
  font-size: 32px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.eye-tips {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  text-align: center;
  margin: 0 0 20px 0;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(5px);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 32px;
}

.progress-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 999px;
  transition: width 0.2s linear;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.overtime-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(251, 191, 36, 0.2);
  border: 2px solid rgba(251, 191, 36, 0.5);
  border-radius: 12px;
  color: #fef3c7;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 32px;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.overtime-notice svg {
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn {
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 140px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.btn-primary {
  background: #ffffff;
  color: #059669;
}

.btn-primary:hover {
  background: #f0fdf4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 动画 */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-active .overlay-content,
.overlay-fade-leave-active .overlay-content {
  transition: transform 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.overlay-fade-enter-from .overlay-content,
.overlay-fade-leave-to .overlay-content {
  transform: scale(0.9);
}
</style>
