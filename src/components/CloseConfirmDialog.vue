<script setup lang="ts">
import { ref, defineProps, defineEmits } from "vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "confirm", minimize: boolean, remember: boolean): void;
}>();

const rememberChoice = ref(false);

function handleMinimize() {
  emit("confirm", true, rememberChoice.value);
  rememberChoice.value = false;
}

function handleQuit() {
  emit("confirm", false, rememberChoice.value);
  rememberChoice.value = false;
}
</script>

<template>
  <teleport to="body">
    <div v-if="props.visible" class="backdrop">
      <div class="dialog" role="dialog" aria-modal="true">
        <header class="dialog-header">
          <h2>关闭应用</h2>
        </header>
        <section class="dialog-body">
          <p class="message">是否最小化到托盘而不是退出应用？</p>
          <label class="checkbox-label">
            <input type="checkbox" v-model="rememberChoice" />
            <span>记住我的选择</span>
          </label>
        </section>
        <footer class="dialog-footer">
          <button type="button" class="secondary" @click="handleQuit">
            退出应用
          </button>
          <button type="button" class="primary" @click="handleMinimize">
            最小化到托盘
          </button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
}

.dialog {
  width: min(400px, 90vw);
  border-radius: 16px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.dialog-header h2 {
  font-size: 18px;
  margin-bottom: 16px;
  font-weight: 600;
}

.dialog-body {
  margin-bottom: 24px;
}

.message {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin-bottom: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer button {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.primary {
  background: #38bdf8;
  color: #ffffff;
  border-color: #0ea5e9;
}

.primary:hover {
  background: #0ea5e9;
}

.secondary {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.secondary:hover {
  background: #f3f4f6;
  color: #374151;
}
</style>
