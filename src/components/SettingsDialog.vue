<script setup lang="ts">
import { reactive, watch, ref } from "vue";
import { useSettings } from "../composables/useSettingsDB";
import UserInfoSection from "./UserInfoSection.vue";

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
const activeTab = ref<'general' | 'account'>('general');

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
          <div class="tabs">
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'general' }"
              @click="activeTab = 'general'"
            >
              常规设置
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'account' }"
              @click="activeTab = 'account'"
            >
              账号信息
            </button>
          </div>
        </header>
        <section class="dialog-body">
          <!-- 账号信息区域 -->
          <div v-show="activeTab === 'account'" class="tab-content">
            <UserInfoSection />
          </div>
          
          <!-- 常规设置区域 -->
          <div v-show="activeTab === 'general'" class="tab-content">
            <!-- 计时设置 -->
            <div class="settings-section">
              <h3 class="section-title">计时设置</h3>
              <div class="form-group">
                <label>
                  <span>计时器模式</span>
                  <select v-model="localSettings.timerMode" class="select-input">
                    <option value="countdown">倒计时模式</option>
                    <option value="stopwatch">正计时模式</option>
                  </select>
                </label>
              </div>

              <div v-if="localSettings.timerMode === 'countdown'" class="form-group">
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

              <div v-if="localSettings.timerMode === 'countdown'" class="form-group">
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

              <div v-if="localSettings.timerMode === 'stopwatch'" class="form-group">
                <label>
                  <span>正计时休息时长</span>
                  <div class="time-inputs">
                    <input
                      type="number"
                      v-model.number="localSettings.stopwatchBreakMinutes"
                      min="0"
                      max="60"
                      placeholder="分"
                    />
                    <span class="unit">分</span>
                    <input
                      type="number"
                      v-model.number="localSettings.stopwatchBreakSeconds"
                      min="0"
                      max="59"
                      placeholder="秒"
                    />
                    <span class="unit">秒</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- 通知与音效 -->
            <div class="settings-section">
              <h3 class="section-title">通知与音效</h3>
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
            </div>

            <!-- 悬浮窗 -->
            <div class="settings-section">
              <h3 class="section-title">悬浮窗</h3>
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="localSettings.enableFloatingWindow" />
                  <span>启用悬浮窗</span>
                </label>
              </div>

              <template v-if="localSettings.enableFloatingWindow">
                <div class="form-group">
                  <label>
                    <span>悬浮窗大小</span>
                    <div class="time-inputs">
                      <input
                        type="number"
                        v-model.number="localSettings.floatingWindowWidth"
                        min="100"
                        max="400"
                        placeholder="宽度"
                      />
                      <span class="unit">×</span>
                      <input
                        type="number"
                        v-model.number="localSettings.floatingWindowHeight"
                        min="40"
                        max="200"
                        placeholder="高度"
                      />
                      <span class="unit">像素</span>
                    </div>
                  </label>
                </div>

                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="localSettings.floatingWindowShowTimer" />
                    <span>悬浮窗显示计时器</span>
                  </label>
                </div>
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="localSettings.floatingWindowShowState" />
                    <span>悬浮窗显示状态</span>
                  </label>
                </div>
              </template>
            </div>

            <!-- 系统 -->
            <div class="settings-section">
              <h3 class="section-title">系统</h3>
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
            </div>
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
  max-height: 85vh;
  border-radius: 16px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.dialog-header h2 {
  font-size: 20px;
  margin-bottom: 16px;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #374151;
  background: rgba(255, 255, 255, 0.5);
}

.tab-btn.active {
  background: #ffffff;
  color: #0ea5e9;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px; /* 避免滚动条遮挡内容 */
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 4px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
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
