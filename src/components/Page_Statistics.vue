<script setup lang="ts">
import { computed, ref } from "vue";
import { useTimerHistory } from "../composables/useTimerHistoryDB";
import type { TimerRecord } from "../composables/useTimerHistoryDB";

const { records, deleteRecord, clearRecords, getTodayRecords, getWeekRecords, getTotalDuration } = useTimerHistory();

// 分类标签映射
const categoryLabels: Record<string, string> = {
  work: "工作",
  entertainment: "娱乐",
  study: "学习",
  exercise: "运动",
  reading: "阅读",
  meeting: "会议",
};

// 时间范围选择
const timeRange = ref<"today" | "week" | "month" | "all">("week");

// 过滤工作记录（排除休息记录）
const workRecords = computed(() => {
  return records.value.filter(r => r.mode === "work");
});

// 根据时间范围过滤记录
const filteredRecords = computed(() => {
  const records = workRecords.value;
  
  switch (timeRange.value) {
    case "today": {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return records.filter(r => r.endTime >= todayStart.getTime());
    }
    case "week": {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return records.filter(r => r.endTime >= weekStart.getTime());
    }
    case "month": {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return records.filter(r => r.endTime >= monthStart.getTime());
    }
    case "all":
    default:
      return records;
  }
});

// 按分类统计时长
const categoryStats = computed(() => {
  const stats: Record<string, number> = {};
  
  filteredRecords.value.forEach(record => {
    const category = record.category || "未分类";
    stats[category] = (stats[category] || 0) + record.duration;
  });
  
  return Object.entries(stats)
    .map(([category, duration]) => ({
      category,
      label: categoryLabels[category] || category,
      duration,
      percentage: 0, // 稍后计算
    }))
    .sort((a, b) => b.duration - a.duration);
});

// 计算总时长和百分比
const totalDuration = computed(() => {
  return categoryStats.value.reduce((sum, item) => sum + item.duration, 0);
});

const categoryStatsWithPercentage = computed(() => {
  const total = totalDuration.value;
  if (total === 0) return [];
  
  return categoryStats.value.map(item => ({
    ...item,
    percentage: (item.duration / total) * 100,
  }));
});

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

// 格式化百分比
function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

// 饼图相关
const chartSize = 280;
const chartCenter = chartSize / 2;
const chartRadius = 100;

// 为每个分类分配颜色
const categoryColors: Record<string, string> = {
  work: "#f59e0b",
  entertainment: "#ec4899",
  study: "#3b82f6",
  exercise: "#22c55e",
  reading: "#8b5cf6",
  meeting: "#ef4444",
  "未分类": "#6b7280",
};

// 生成饼图路径
function generatePieChart() {
  if (categoryStatsWithPercentage.value.length === 0) return [];
  
  let currentAngle = -90; // 从顶部开始
  
  return categoryStatsWithPercentage.value.map(item => {
    const startAngle = currentAngle;
    const sweepAngle = (item.percentage / 100) * 360;
    const endAngle = startAngle + sweepAngle;
    
    // 计算路径
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = chartCenter + chartRadius * Math.cos(startRad);
    const y1 = chartCenter + chartRadius * Math.sin(startRad);
    const x2 = chartCenter + chartRadius * Math.cos(endRad);
    const y2 = chartCenter + chartRadius * Math.sin(endRad);
    
    const largeArc = sweepAngle > 180 ? 1 : 0;
    
    const path = [
      `M ${chartCenter} ${chartCenter}`,
      `L ${x1} ${y1}`,
      `A ${chartRadius} ${chartRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    currentAngle = endAngle;
    
    return {
      category: item.category,
      label: item.label,
      path,
      color: categoryColors[item.category] || categoryColors["未分类"],
      percentage: item.percentage,
      duration: item.duration,
    };
  });
}

const pieChartData = computed(() => generatePieChart());

// 悬停状态
const hoveredCategory = ref<string | null>(null);

// 历史记录相关功能
// 获取分类显示名称
function getCategoryLabel(category: string | null): string {
  if (!category) return "未分类";
  return categoryLabels[category] || category;
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
  return record.mode === "work" ? "工作" : "休息";
}

// 获取记录类型颜色
function getRecordColor(record: TimerRecord): string {
  if (record.mode === "work") {
    return "#f59e0b"; // 橙色 - 工作
  }
  return "#22c55e"; // 绿色 - 休息
}

// 根据时间范围过滤所有记录（包括工作和休息）
const filteredAllRecords = computed(() => {
  const allRecords = records.value;
  
  switch (timeRange.value) {
    case "today": {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return allRecords.filter(r => r.endTime >= todayStart.getTime());
    }
    case "week": {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return allRecords.filter(r => r.endTime >= weekStart.getTime());
    }
    case "month": {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return allRecords.filter(r => r.endTime >= monthStart.getTime());
    }
    case "all":
    default:
      return allRecords;
  }
});

// 确认清空
function handleClearAll() {
  if (records.value.length === 0) return;
  
  if (confirm(`确定要清空所有 ${records.value.length} 条历史记录吗？此操作不可恢复。`)) {
    clearRecords();
  }
}
</script>

<template>
  <div class="statistics-panel">
    <!-- 时间范围选择 -->
    <div class="time-range-selector">
      <button
        v-for="range in [
          { value: 'today', label: '今日' },
          { value: 'week', label: '本周' },
          { value: 'month', label: '本月' },
          { value: 'all', label: '全部' },
        ]"
        :key="range.value"
        type="button"
        class="range-btn"
        :class="{ active: timeRange === range.value }"
        @click="timeRange = range.value as any"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 总时长卡片 -->
    <div class="total-card">
      <div class="total-label">总工作时长</div>
      <div class="total-value">{{ formatDuration(totalDuration) }}</div>
      <div class="total-count">{{ filteredRecords.length }} 次工作记录</div>
    </div>

    <div v-if="categoryStatsWithPercentage.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>暂无数据</p>
    </div>

    <div v-else class="chart-section">
      <!-- 饼图 -->
      <div class="pie-chart-container">
        <svg :width="chartSize" :height="chartSize" class="pie-chart">
          <g
            v-for="item in pieChartData"
            :key="item.category"
            @mouseenter="hoveredCategory = item.category"
            @mouseleave="hoveredCategory = null"
          >
            <path
              :d="item.path"
              :fill="item.color"
              :class="{ 
                'chart-slice': true,
                'hovered': hoveredCategory === item.category,
                'dimmed': hoveredCategory !== null && hoveredCategory !== item.category
              }"
            />
          </g>
        </svg>
      </div>

      <!-- 图例和详细数据 -->
      <div class="legend-list">
        <div
          v-for="item in categoryStatsWithPercentage"
          :key="item.category"
          class="legend-item"
          :class="{ 
            'hovered': hoveredCategory === item.category,
            'dimmed': hoveredCategory !== null && hoveredCategory !== item.category
          }"
          @mouseenter="hoveredCategory = item.category"
          @mouseleave="hoveredCategory = null"
        >
          <div class="legend-color" :style="{ backgroundColor: categoryColors[item.category] || categoryColors['未分类'] }"></div>
          <div class="legend-content">
            <div class="legend-header">
              <span class="legend-label">{{ item.label }}</span>
              <span class="legend-percentage">{{ formatPercentage(item.percentage) }}</span>
            </div>
            <div class="legend-duration">{{ formatDuration(item.duration) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史记录部分 -->
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

      <div v-if="filteredAllRecords.length === 0" class="empty-state-records">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>暂无历史记录</p>
      </div>

      <div v-else class="records-list">
        <div 
          v-for="record in filteredAllRecords" 
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
                <span class="category-text">
                  🏷️ {{ getCategoryLabel(record.category || null) }}
                </span>
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
.statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  min-height: 400px;
}

.time-range-selector {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 8px;
  flex-shrink: 0;
}

.range-btn {
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

.range-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.range-btn.active {
  background: var(--bg-card);
  color: var(--primary-color);
  box-shadow: 0 1px 2px var(--shadow-color);
}

.total-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px var(--shadow-color);
  text-align: center;
  border-left: 4px solid #f59e0b;
  flex-shrink: 0;
}

.total-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.total-value {
  font-size: 32px;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 4px;
}

.total-count {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
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

.chart-section {
  display: flex;
  gap: 32px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px var(--shadow-color);
  flex-shrink: 0;
  min-height: 350px;
}

.pie-chart-container {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-chart {
  filter: drop-shadow(0 4px 6px var(--shadow-color));
}

.chart-slice {
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
  transform-origin: center;
}

.chart-slice.hovered {
  opacity: 1;
  filter: brightness(1.1);
}

.chart-slice.dimmed {
  opacity: 0.5;
}

.legend-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 8px;
}

.legend-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.legend-item:hover,
.legend-item.hovered {
  background: var(--bg-hover);
  transform: translateX(4px);
}

.legend-item.dimmed {
  opacity: 0.5;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.legend-content {
  flex: 1;
  min-width: 0;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
}

.legend-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.legend-percentage {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  flex-shrink: 0;
}

.legend-duration {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 滚动条样式 */
.legend-list::-webkit-scrollbar {
  width: 6px;
}

.legend-list::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 3px;
}

.legend-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.legend-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 历史记录样式 */
.records-section {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  max-height: 400px;
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

.empty-state-records {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty-state-records svg {
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state-records p {
  font-size: 14px;
  margin: 0;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
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
  padding: 2px 6px;
  border-radius: 4px;
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

/* 历史记录滚动条样式 */
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
