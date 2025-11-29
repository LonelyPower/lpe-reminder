<script setup lang="ts">
import { ref } from "vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "confirm", minimize: boolean, remember: boolean): void;
  (e: "cancel"): void;
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

function handleCancel() {
  emit("cancel");
  rememberChoice.value = false;
}
</script>

<template>
  <div v-if="props.visible" class="backdrop">
    <div class="dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
          <h2>关闭应用</h2>
          <button type="button" class="close-btn" @click="handleCancel" aria-label="取消">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
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
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
  backdrop-filter: blur(4px);
}

.dialog {
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100% - 48px);
  border-radius: 16px;
  background: var(--bg-card);
  padding: 24px;
  box-shadow: 0 18px 40px var(--shadow-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dialog-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:active {
  background: var(--bg-secondary);
}

.dialog-body {
  margin-bottom: 24px;
}

.message {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--primary-color);
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
  background: var(--primary-color);
  color: #ffffff;
  border-color: var(--primary-color);
}

.primary:hover {
  background: var(--primary-hover);
}

.secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.secondary:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
</style>
