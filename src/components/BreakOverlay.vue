<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

interface Props {
  visible: boolean;
  remainingSeconds: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "skip"): void;
}>();
</script>

<template>
  <teleport to="body">
    <div v-if="props.visible" class="overlay">
      <div class="overlay-card">
        <div class="countdown">
          {{ props.remainingSeconds }}
        </div>
        <p class="tip">闭目轻轻转动眼球，缓解干涩与疲劳。</p>
        <button type="button" class="skip-btn" @click="emit('skip')">
          跳过本次休息
        </button>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.overlay-card {
  width: min(480px, 90vw);
  padding: 32px 28px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.96);
  text-align: center;
}

.countdown {
  font-size: 56px;
  margin-bottom: 16px;
}

.tip {
  font-size: 16px;
  color: #4b5563;
  margin-bottom: 24px;
}

.skip-btn {
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
}

.skip-btn:hover {
  background: #f3f4f6;
}
</style>
