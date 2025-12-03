<script setup lang="ts">
import { reactive, watch, ref } from "vue";
import { useSettings } from "../composables/useSettingsDB";
import UserInfoSection from "./Section_UserInfo.vue";
import BaseDialog from "./Dialog_Base.vue";
import { checkForUpdates } from "../utils/updater";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { settings: globalSettings, defaultSettings, save: saveSettings } = useSettings();

// 本地状态，用于表单编辑，避免实时修改全局配置
const localSettings = reactive({ ...globalSettings });
const activeTab = ref<'general' | 'account'>('general');
const isSaving = ref(false);
const isCheckingUpdate = ref(false);

// 当弹窗打开时，同步全局配置到本地
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      Object.assign(localSettings, globalSettings);
    }
  }
);

async function handleSave() {
  // 先更新全局设置（供 UI 立即响应）
  Object.assign(globalSettings, localSettings);

  // 然后保存到数据库
  isSaving.value = true;
  try {
    await saveSettings();
    emit("close");
  } catch (error) {
    console.error("Failed to save settings:", error);
    // 可以在这里显示错误提示
    alert("保存设置失败，请重试");
  } finally {
    isSaving.value = false;
  }
}

function handleResetLocal() {
  Object.assign(localSettings, defaultSettings);
}

async function handleCheckUpdate() {
  isCheckingUpdate.value = true;
  try {
    await checkForUpdates(false);
  } finally {
    isCheckingUpdate.value = false;
  }
}
</script>

<template>
  <BaseDialog :visible="props.visible" title="设置" width="450px" height="550px" :show-footer="false"
    @close="emit('close')">
    <template #header>
      <div class="header-content">
        <!-- <h2>设置</h2> -->
        <div class="tabs">
          <button class="tab-btn" :class="{ active: activeTab === 'general' }"
            @click="activeTab = 'general'">常规设置</button>
          <button class="tab-btn" :class="{ active: activeTab === 'account' }"
            @click="activeTab = 'account'">账号信息</button>
        </div>
        <div class="header-actions">
          <button type="button" class="save-btn" @click="handleSave" :disabled="isSaving">
            {{ isSaving ? '保存中...' : '保存' }}
          </button>
          <button type="button" class="close-btn-custom" @click="emit('close')" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

    </template>

    <template #default>
      <!-- 账号信息区域 -->
      <div v-show="activeTab === 'account'" class="tab-content">
        <UserInfoSection />
      </div>

      <!-- 常规设置区域 -->
      <div v-show="activeTab === 'general'" class="tab-content">
        <!-- 外观设置 -->
        <div class="settings-section">
          <h3 class="section-title">外观</h3>
          <div class="form-group">
            <label>
              <span>主题模式</span>
              <select v-model="localSettings.theme" class="select-input">
                <option value="system">跟随系统</option>
                <option value="light">浅色模式</option>
                <option value="dark">深色模式</option>
              </select>
            </label>
          </div>
        </div>

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
                <input type="number" v-model.number="localSettings.workDurationMinutes" min="0" max="120"
                  placeholder="分" />
                <span class="unit">分</span>
                <input type="number" v-model.number="localSettings.workDurationSeconds" min="0" max="59"
                  placeholder="秒" />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>

          <div v-if="localSettings.timerMode === 'countdown'" class="form-group">
            <label>
              <span>休息时长</span>
              <div class="time-inputs">
                <input type="number" v-model.number="localSettings.breakDurationMinutes" min="0" max="60"
                  placeholder="分" />
                <span class="unit">分</span>
                <input type="number" v-model.number="localSettings.breakDurationSeconds" min="0" max="59"
                  placeholder="秒" />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>

          <div v-if="localSettings.timerMode === 'stopwatch'" class="form-group">
            <label>
              <span>正计时提醒时间</span>
              <div class="time-inputs">
                <input type="number" v-model.number="localSettings.stopwatchReminderMinutes" min="0" max="60"
                  placeholder="分" />
                <span class="unit">分</span>
                <input type="number" v-model.number="localSettings.stopwatchReminderSeconds" min="0" max="59"
                  placeholder="秒" />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>

          <div v-if="localSettings.timerMode === 'stopwatch'" class="form-group">
            <label>
              <span>正计时休息时长</span>
              <div class="time-inputs">
                <input type="number" v-model.number="localSettings.stopwatchBreakMinutes" min="0" max="60"
                  placeholder="分" />
                <span class="unit">分</span>
                <input type="number" v-model.number="localSettings.stopwatchBreakSeconds" min="0" max="59"
                  placeholder="秒" />
                <span class="unit">秒</span>
              </div>
            </label>
          </div>
        </div>

        <!-- 通知与音效 -->
        <div class="settings-section">
          <h3 class="section-title">通知与音效</h3>
          <div class="form-group checkbox-group checkbox-row">
            <label>
              <input type="checkbox" v-model="localSettings.enableworkSound" />
              <span>启用工作结束提示音</span>
            </label>
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
          <div class="section-header">
            <h3 class="section-title-inline">悬浮窗</h3>
            <label class="header-checkbox">
              <input type="checkbox" v-model="localSettings.enableFloatingWindow" />
              <span>启用悬浮窗</span>
            </label>
          </div>

          <template v-if="localSettings.enableFloatingWindow">
            <div class="form-group">
              <label>
                <span>悬浮窗大小</span>
                <div class="time-inputs">
                  <input type="number" v-model.number="localSettings.floatingWindowWidth" min="100" max="400"
                    placeholder="宽度" />
                  <span class="unit">×</span>
                  <input type="number" v-model.number="localSettings.floatingWindowHeight" min="40" max="200"
                    placeholder="高度" />
                  <span class="unit">像素</span>
                </div>
              </label>
            </div>

            <div class="form-group checkbox-group checkbox-row">
              <label>
                <input type="checkbox" v-model="localSettings.floatingWindowShowTimer" />
                <span>悬浮窗显示计时器</span>
              </label>
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
          <div class="form-group">
            <label>
              <span>应用更新</span>
              <button type="button" class="update-btn" @click="handleCheckUpdate" :disabled="isCheckingUpdate">
                {{ isCheckingUpdate ? '检查中...' : '检查更新' }}
              </button>
            </label>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button type="button" class="ghost" @click="handleResetLocal" :disabled="isSaving">
          恢复默认
        </button>
        <button type="button" class="ghost" @click="emit('close')" :disabled="isSaving">
          取消
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
/* 自定义头部布局 */
:deep(.dialog-header) {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  position: relative;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-content h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 隐藏 BaseDialog 的默认关闭按钮 */
:deep(.close-btn) {
  display: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: var(--primary-color);
  color: #ffffff;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn-custom {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn-custom:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab-btn.active {
  background: var(--bg-card);
  color: var(--primary-color);
  box-shadow: 0 1px 2px var(--shadow-color);
}

/* 覆盖默认的 body 样式 */
:deep(.dialog-body) {
  padding-right: 28px;
  padding-left: 24px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.section-title-inline {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: normal;
}

.header-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--primary-color);
}

.form-group label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-primary);
}

.form-group input[type="number"] {
  width: 60px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  text-align: right;
  background: var(--bg-card);
  color: var(--text-primary);
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit {
  font-size: 14px;
  color: var(--text-secondary);
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
  accent-color: var(--primary-color);
}

.checkbox-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 24px;
}

.select-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 140px;
}

.select-input:hover {
  border-color: var(--text-secondary);
}

.footer-actions,
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.footer-actions button,
.dialog-actions button {
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

.ghost {
  background: transparent;
  color: var(--text-secondary);
}

.ghost:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.update-btn {
  padding: 6px 16px;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  font-size: 14px;
  background: transparent;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}

.update-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: #ffffff;
}

.update-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
