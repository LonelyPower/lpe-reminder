<script setup lang="ts">
import { ref } from "vue";
import BaseDialog from "./BaseDialog.vue";

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
  <BaseDialog :visible="props.visible" title="关闭应用" width="400px" @close="handleCancel">
    <template #default>
      <p class="message">是否最小化到托盘而不是退出应用？</p>
      <label class="checkbox-label">
        <input type="checkbox" v-model="rememberChoice" />
        <span>记住我的选择</span>
      </label>
    </template>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleQuit">
        退出应用
      </button>
      <button type="button" class="btn btn-primary" @click="handleMinimize">
        最小化到托盘
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
/* 覆盖 BaseDialog 的 z-index */
:deep(.backdrop) {
  z-index: 9500;
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

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color);
  color: #ffffff;
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
</style>
