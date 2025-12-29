<script setup lang="ts">
import { ref } from 'vue';
import BaseDialog from './Dialog_Base.vue';

interface Props {
  visible: boolean;
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  isDownloading?: boolean;
  isComplete?: boolean;
  errorMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  version: '',
  currentVersion: '',
  releaseNotes: '',
  isDownloading: false,
  isComplete: false,
  errorMessage: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
  (e: 'relaunch'): void;
  (e: 'later'): void;
}>();

// 格式化更新说明
const formattedNotes = ref(props.releaseNotes || '暂无更新说明');
</script>

<template>
  <BaseDialog :visible="visible" width="420px" :show-footer="false" @close="emit('close')">
    <template #header>
      <div class="update-header">
        <div class="icon-wrapper">
          <svg v-if="!isComplete && !errorMessage" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <svg v-else-if="isComplete" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="success-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="9 12 11 14 15 10"></polyline>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="title-wrapper">
          <h2 v-if="!isComplete && !errorMessage">发现新版本</h2>
          <h2 v-else-if="isComplete">更新完成</h2>
          <h2 v-else>更新失败</h2>
          <p class="version-info" v-if="!errorMessage">
            {{ currentVersion }} → <span class="new-version">{{ version }}</span>
          </p>
        </div>
        <button type="button" class="close-btn" @click="emit('close')" aria-label="关闭">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </template>

    <!-- 内容区域 -->
    <div class="update-content">
      <!-- 错误信息 -->
      <div v-if="errorMessage" class="error-content">
        <p class="error-text">{{ errorMessage }}</p>
      </div>

      <!-- 下载中 -->
      <div v-else-if="isDownloading" class="downloading-content">
        <div class="loading-spinner"></div>
        <p class="downloading-text">正在下载更新...</p>
        <p class="downloading-tip">请稍候，下载完成后会自动安装</p>
      </div>

      <!-- 更新完成 -->
      <div v-else-if="isComplete" class="complete-content">
        <p class="complete-text">更新已下载并安装完成！</p>
        <p class="complete-tip">重启应用后即可使用新版本</p>
      </div>

      <!-- 更新说明 -->
      <div v-else class="update-notes">
        <h3>更新内容</h3>
        <div class="notes-content">
          {{ formattedNotes }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="update-actions">
        <!-- 发现更新时的按钮 -->
        <template v-if="!isDownloading && !isComplete && !errorMessage">
          <button type="button" class="btn-secondary" @click="emit('close')">
            稍后更新
          </button>
          <button type="button" class="btn-primary" @click="emit('confirm')">
            立即下载
          </button>
        </template>

        <!-- 更新完成时的按钮 -->
        <template v-else-if="isComplete">
          <button type="button" class="btn-secondary" @click="emit('later')">
            稍后重启
          </button>
          <button type="button" class="btn-primary" @click="emit('relaunch')">
            立即重启
          </button>
        </template>

        <!-- 错误时的按钮 -->
        <template v-else-if="errorMessage">
          <button type="button" class="btn-primary" @click="emit('close')">
            关闭
          </button>
        </template>
      </div>
    </div>
  </BaseDialog>
</template>

<style scoped>
.update-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--primary-color-10);
  color: var(--primary-color);
  flex-shrink: 0;
}

.success-icon {
  color: #10b981;
}

.error-icon {
  color: #ef4444;
}

.title-wrapper {
  flex: 1;
}

.title-wrapper h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.version-info {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.new-version {
  color: var(--primary-color);
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-hover);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.update-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.update-notes h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.notes-content {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.downloading-content,
.complete-content,
.error-content {
  text-align: center;
  padding: 24px 0;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border: 4px solid var(--bg-secondary);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.downloading-text,
.complete-text {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.downloading-tip,
.complete-tip {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.update-actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-color-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-color-20);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-secondary:active {
  background: var(--bg-active);
}
</style>
