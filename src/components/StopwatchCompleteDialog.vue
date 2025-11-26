<script setup lang="ts">
import { ref } from "vue";

interface Props {
  visible: boolean;
  elapsedMs: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "confirm", data: { name: string; takeBreak: boolean }): void;
  (e: "cancel"): void;
}>();

const workName = ref("");
const takeBreak = ref(true);

// 格式化时长
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

function handleConfirm() {
  emit("confirm", {
    name: workName.value.trim() || "未命名工作",
    takeBreak: takeBreak.value,
  });
  // 重置状态
  workName.value = "";
//   takeBreak.value = false;
}

function handleCancel() {
  emit("cancel");
  // 重置状态
  workName.value = "";
//   takeBreak.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="dialog-content">
          <div class="dialog-header">
            <h2>工作完成</h2>
            <button 
              type="button" 
              class="close-btn" 
              @click="handleCancel"
              aria-label="关闭"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="dialog-body">
            <div class="duration-display">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <div class="duration-text">
                <div class="label">本次工作时长</div>
                <div class="value">{{ formatDuration(elapsedMs) }}</div>
              </div>
            </div>

            <div class="form-group">
              <label for="work-name" class="form-label">工作名称（可选）</label>
              <input
                id="work-name"
                v-model="workName"
                type="text"
                class="form-input"
                placeholder="例如：编写报告、学习英语..."
                maxlength="50"
                @keyup.enter="handleConfirm"
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="takeBreak"
                  type="checkbox"
                  class="checkbox"
                />
                <span>需要休息</span>
              </label>
              <p class="help-text">勾选后将开始休息倒计时</p>
            </div>
          </div>

          <div class="dialog-footer">
            <button type="button" class="btn btn-secondary" @click="handleCancel">
              取消
            </button>
            <button type="button" class="btn btn-primary" @click="handleConfirm">
              确定
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.dialog-content {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #111827;
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
  color: #9ca3af;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.dialog-body {
  padding: 24px;
}

.duration-display {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  border-radius: 12px;
  margin-bottom: 24px;
}

.duration-display svg {
  color: #10b981;
  flex-shrink: 0;
}

.duration-text {
  flex: 1;
}

.duration-text .label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.duration-text .value {
  font-size: 24px;
  font-weight: 600;
  color: #10b981;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  transition: all 0.2s;
  outline: none;
}

.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.help-text {
  margin: 8px 0 0 26px;
  font-size: 12px;
  color: #9ca3af;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-active .dialog-content,
.dialog-fade-leave-active .dialog-content {
  transition: transform 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-content,
.dialog-fade-leave-to .dialog-content {
  transform: scale(0.9);
}
</style>
