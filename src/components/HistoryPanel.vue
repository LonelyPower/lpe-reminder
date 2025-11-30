<script setup lang="ts">
import { computed, ref } from "vue";
import { useTimerHistory } from "../composables/useTimerHistoryDB";
import type { TimerRecord } from "../composables/useTimerHistoryDB";
import { updateTimerRecord } from "../utils/database";

const { records, deleteRecord, clearRecords, getTodayRecords, getWeekRecords, getTotalDuration, loadRecords } = useTimerHistory();

// 编辑分类状态
const editingRecordId = ref<number | null>(null);
const editingCategory = ref<string>("");

// 获取分类标签映射
const categoryLabels: Record<string, string> = {
  work: "工作",
  entertainment: "娱乐",
  study: "学习",
  exercise: "运动",
  reading: "阅读",
  meeting: "会议",
  break: "休息",
};

// 获取分类显示名称
function getCategoryLabel(category: string | null): string {
  if (!category) return "未分类";
  return categoryLabels[category] || category;
}

// 开始编辑分类
function startEditCategory(record: TimerRecord) {
  // 使用 Number(record.id) 转换 ID（如果 ID 是数字字符串）
  // 或者从 record.id 中提取数字部分
  const numericId = parseInt(record.id.split("-")[0], 10);
  editingRecordId.value = numericId;
  editingCategory.value = record.category || "";
}

// 保存分类
async function saveCategory(recordId: number) {
  try {
    await updateTimerRecord(recordId, { category: editingCategory.value || null });
    await loadRecords(); // 重新加载记录
    editingRecordId.value = null;
    editingCategory.value = "";
  } catch (error) {
    console.error("Failed to update category:", error);
    alert("保存失败，请重试");
  }
}

// 取消编辑
function cancelEditCategory() {
  editingRecordId.value = null;
  editingCategory.value = "";
}

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

// 格式化日期时间
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dateStr = date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  
  if (date.getTime() >= today.getTime()) {
    return `今天 ${timeStr}`;
  }
  return `${dateStr} ${timeStr}`;
}

// 获取记录类型文本
function getRecordTypeText(record: TimerRecord): string {
  // if (record.type === "countdown") {
  //   return record.mode === "work" ? "工作" : "休息";
  // }
  // // 正计时
  return record.mode === "work" ? "工作" : "休息";
}

// 获取记录类型颜色
function getRecordColor(record: TimerRecord): string {
  // 工作记录用橙色，休息记录用绿色
  if (record.mode === "work") {
    return "#f59e0b"; // 橙色 - 工作
  }
  return "#22c55e"; // 绿色 - 休息
}

// 统计数据
const todayRecords = computed(() => getTodayRecords());
const weekRecords = computed(() => getWeekRecords());

const todayWorkRecords = computed(() => todayRecords.value.filter(r => r.mode === "work"));
const weekWorkRecords = computed(() => weekRecords.value.filter(r => r.mode === "work"));

const todayWorkTotal = computed(() => getTotalDuration(todayWorkRecords.value));
const weekWorkTotal = computed(() => getTotalDuration(weekWorkRecords.value));

// 确认清空
function handleClearAll() {
  if (records.value.length === 0) return;
  
  if (confirm(`确定要清空所有 ${records.value.length} 条历史记录吗？此操作不可恢复。`)) {
    clearRecords();
  }
}
</script>

<template>
  <div class="history-panel">
    <div class="stats-section">
      <div class="stat-card work-card">
        <div class="stat-label">今日工作</div>
        <div class="stat-value">{{ formatDuration(todayWorkTotal) }}</div>
        <div class="stat-count">{{ todayWorkRecords.length }} 次</div>
      </div>
      <!-- <div class="stat-card break-card">
        <div class="stat-label">今日休息</div>
        <div class="stat-value">{{ formatDuration(todayBreakTotal) }}</div>
        <div class="stat-count">{{ todayBreakRecords.length }} 次</div>
      </div> -->
      <div class="stat-card work-card">
        <div class="stat-label">本周工作</div>
        <div class="stat-value">{{ formatDuration(weekWorkTotal) }}</div>
        <div class="stat-count">{{ weekWorkRecords.length }} 次</div>
      </div>
      <!-- <div class="stat-card break-card">
        <div class="stat-label">本周休息</div>
        <div class="stat-value">{{ formatDuration(weekBreakTotal) }}</div>
        <div class="stat-count">{{ weekBreakRecords.length }} 次</div>
      </div> -->
    </div>

    <div class="records-section">
      <div class="section-header">
        <h3>历史记录</h3>
        <button 
          v-if="records.length > 0"
          type="button" 
          class="clear-btn" 
          @click="handleClearAll"
        >
          清空记录
        </button>
      </div>

      <div v-if="records.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>暂无历史记录</p>
      </div>

      <div v-else class="records-list">
        <div 
          v-for="record in records" 
          :key="record.id" 
          class="record-item"
        >
          <div class="record-indicator" :style="{ backgroundColor: getRecordColor(record) }"></div>
          <div class="record-content">
            <div class="record-header">
              <div class="record-title">
                <span class="record-type">{{ getRecordTypeText(record) }}</span>
                <span v-if="record.name" class="record-name">{{ record.name }}</span>
              </div>
              <span class="record-duration">{{ formatDuration(record.duration) }}</span>
            </div>
            <div class="record-meta">
              <span class="record-time">{{ formatDateTime(record.endTime) }}</span>
              <span v-if="record.mode === 'work'" class="record-category">
                <template v-if="editingRecordId === parseInt(record.id.split('-')[0], 10)">
                  <input
                    v-model="editingCategory"
                    type="text"
                    class="category-input"
                    placeholder="输入分类"
                    @keyup.enter="saveCategory(editingRecordId!)"
                    @keyup.esc="cancelEditCategory"
                  />
                  <button type="button" class="save-btn" @click="saveCategory(editingRecordId!)">✓</button>
                  <button type="button" class="cancel-btn" @click="cancelEditCategory">✕</button>
                </template>
                <template v-else>
                  <span class="category-text" @click="startEditCategory(record)">
                    🏷️ {{ getCategoryLabel(record.category || null) }}
                  </span>
                </template>
              </span>
            </div>
          </div>
          <button 
            type="button" 
            class="delete-btn" 
            @click="deleteRecord(record.id)"
            aria-label="删除记录"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  max-width: 100%;
  margin: 0;
  padding: 0;
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 0;
  flex-shrink: 0;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  border-left: 4px solid transparent;
}

.stat-card.work-card {
  border-left-color: #f59e0b;
}

.stat-card.work-card .stat-value {
  color: #f59e0b;
}

.stat-card.break-card {
  border-left-color: #22c55e;
}

.stat-card.break-card .stat-value {
  color: #22c55e;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-count {
  font-size: 12px;
  color: var(--text-muted);
}

.records-section {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.clear-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #ef4444;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  max-height: none;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  transition: background 0.2s;
}

.record-item:hover {
  background: var(--bg-hover);
}

.record-indicator {
  width: 4px;
  height: 40px;
  border-radius: 2px;
  flex-shrink: 0;
}

.record-content {
  flex: 1;
  min-width: 0;
}

.record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.record-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.record-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex-shrink: 0;
}

.record-name {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-name::before {
  content: "·";
  margin-right: 4px;
}

.record-duration {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-time {
  font-size: 12px;
  color: var(--text-muted);
}

.record-category {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.category-text {
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.category-text:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}

.category-input {
  width: 100px;
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.category-input:focus {
  border-color: var(--primary-color);
}

.save-btn,
.cancel-btn {
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.save-btn {
  background: var(--primary-color);
  color: #ffffff;
}

.save-btn:hover {
  background: var(--primary-hover);
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.delete-btn {
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
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 滚动条样式 */
.records-list::-webkit-scrollbar {
  width: 6px;
}

.records-list::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 3px;
}

.records-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.records-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
