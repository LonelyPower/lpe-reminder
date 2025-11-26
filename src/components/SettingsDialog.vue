<script setup lang="ts">
import { defineProps, defineEmits, reactive, watch } from "vue";
import { useSettings } from "../composables/useSettings";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { settings: globalSettings, defaultSettings } = useSettings();

// 本地状态，用于表单编辑，避免实时修改全局配置
const localSettings = reactive({ ...globalSettings });

// 当弹窗打开时，同步全局配置到本地
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      Object.assign(localSettings, globalSettings);
    }
  }
);

function handleSave() {
  Object.assign(globalSettings, localSettings);
  emit("close");
}

function handleResetLocal() {
  Object.assign(localSettings, defaultSettings);
}
</script>

<template>
  <teleport to="body">
    <div v-if="props.visible" class="backdrop" @click.self="emit('close')">
      <div class="dialog" role="dialog" aria-modal="true">
        <header class="dialog-header">
          <h2>设置</h2>
        </header>
        <section class="dialog-body">
          <div class="form-group">
            <label>
              <span>工作时长</span>
              <div class="time-inputs">
                <input
                  type="number"
                  v-model.number="localSettings.workDurationMinutes"
                  min="0"
                  max="120"
                  placeholder="分"
                />
                <span class="unit">分</span>
                <input
                  type="number"
                  v-model.number="localSettings.workDurationSeconds"
                  min="0"
                  max="59"
                  placeholder="秒"
                />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>
              <span>休息时长</span>
              <div class="time-inputs">
                <input
                  type="number"
                  v-model.number="localSettings.breakDurationMinutes"
                  min="0"
                  max="60"
                  placeholder="分"
                />
                <span class="unit">分</span>
                <input
                  type="number"
                  v-model.number="localSettings.breakDurationSeconds"
                  min="0"
                  max="59"
                  placeholder="秒"
                />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="localSettings.enableworkSound" />
              <span>启用工作结束提示音</span>
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="localSettings.enablerestSound" />
              <span>启用休息结束提示音</span>
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="localSettings.enableNotification" />
              <span>启用系统通知</span>
            </label>
          </div>

          <div class="form-group">
            <label>
              <span>关闭窗口时</span>
              <select v-model="localSettings.closeBehavior" class="select-input">
                <option value="ask">询问</option>
                <option value="minimize">最小化到托盘</option>
                <option value="quit">退出应用</option>
              </select>
            </label>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="localSettings.enableFloatingBall" />
              <span>显示桌面悬浮球</span>
            </label>
          </div>
        </section>
        <footer class="dialog-footer">
          <button type="button" class="ghost" @click="handleResetLocal">
            恢复默认
          </button>
          <button type="button" class="ghost" @click="emit('close')">
            取消
          </button>
          <button type="button" class="primary" @click="handleSave">
            完成
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
  z-index: 9000;
}

.dialog {
  width: min(480px, 90vw);
  border-radius: 16px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.dialog-header h2 {
  font-size: 20px;
  margin-bottom: 20px;
  font-weight: 600;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.form-group label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #374151;
}

.form-group input[type="number"] {
  width: 60px;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  text-align: right;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit {
  font-size: 14px;
  color: #6b7280;
}

.checkbox-group label {
  justify-content: flex-start;
  gap: 10px;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.select-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 140px;
}

.select-input:hover {
  border-color: #9ca3af;
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

.ghost {
  background: transparent;
  color: #6b7280;
}

.ghost:hover {
  background: #f3f4f6;
  color: #374151;
}
</style>
