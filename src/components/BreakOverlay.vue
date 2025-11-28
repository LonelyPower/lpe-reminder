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
  <Transition name="overlay-fade">
    <div v-if="visible" class="overlay">
      <div class="overlay-content">
        <div class="icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
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
        <p class="eye-tips">
          💡 闭目轻轻转动眼球，缓解干涩与疲劳
        </p>

        <div v-if="!isOvertime" class="progress-bar">
          <div class="progress-fill" :style="{ width: getProgress(elapsedMs, targetMs) + '%' }"></div>
        </div>

        <div v-if="isOvertime" class="overtime-notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
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
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(245, 247, 245, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.overlay-content {
  text-align: center;
  max-width: 480px;
  width: 100%;
  background: #FFFFFF;
  padding: 40px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #ECFDF5;
  color: #059669;
  margin-bottom: 24px;
  animation: pulse 2s ease-in-out infinite;
}

.icon-wrapper svg {
  color: #059669;
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #1F2937;
  margin: 0 0 24px;
}

.timer-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}

.time {
  font-size: 64px;
  font-weight: 700;
  color: #059669;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.target {
  font-size: 24px;
  font-weight: 500;
  color: #9CA3AF;
}

.eye-tips {
  font-size: 15px;
  color: #4B5563;
  text-align: center;
  margin: 0 0 32px 0;
  padding: 16px;
  background: #F9FAFB;
  border-radius: 12px;
  border: 1px solid #E5E7EB;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #F3F4F6;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 32px;
}

.progress-fill {
  height: 100%;
  background: #059669;
  border-radius: 999px;
  transition: width 0.2s linear;
}

.overtime-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: #FEF3C7;
  border: 1px solid #FCD34D;
  border-radius: 12px;
  color: #92400E;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
}

.actions {
  display: flex;
  justify-content: center;
}

.btn {
  padding: 12px 32px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #059669;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
}

.btn-primary:hover {
  background: #047857;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

.margin-bottom {
  margin-bottom: 32px;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
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
