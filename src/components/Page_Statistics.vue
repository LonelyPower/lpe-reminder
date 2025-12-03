<script setup lang="ts">
import { computed, ref, onActivated } from "vue";
import { useTimerHistory } from "../composables/useTimerHistoryDB";
import type { TimerRecord } from "../composables/useTimerHistoryDB";
import { getCustomCategories } from "../utils/database";
import { confirm } from '@tauri-apps/plugin-dialog';

// 分类标签映射（动态加载）
const categoryLabels = ref<Record<string, string>>({
    work: "工作",
    entertainment: "娱乐",
    study: "学习",
    exercise: "运动",
    reading: "阅读",
    meeting: "会议",
});

// 加载自定义分类
const loadCategories = async () => {
    try {
        const categories = await getCustomCategories();
        // 重置为默认值，然后添加数据库中的分类
        categoryLabels.value = {
            work: "工作",
            entertainment: "娱乐",
            study: "学习",
            exercise: "运动",
            reading: "阅读",
            meeting: "会议",
        };
        categories.forEach(cat => {
            categoryLabels.value[cat.value] = cat.label;
        });
    } catch (error) {
        console.error("Failed to load categories for statistics:", error);
    }
};

// 立即执行加载
loadCategories();

const { records, deleteRecord, clearRecords } = useTimerHistory();

// 当页面激活时重新加载分类（处理从其他页面切换回来的情况）
onActivated(() => {
    loadCategories();
});

// 时间范围选择
const timeRange = ref<"today" | "week" | "month" | "all">("today");

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
            label: categoryLabels.value[category] || category,
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
const chartSize = 220;
const chartCenter = chartSize / 2;
const chartRadius = 90;

// 饼图区域高度（可拖动调整）
const chartSectionHeight = ref(350);
const isResizing = ref(false);
const resizeStartY = ref(0);
const resizeStartHeight = ref(0);

function startResize(e: MouseEvent) {
    isResizing.value = true;
    resizeStartY.value = e.clientY;
    resizeStartHeight.value = chartSectionHeight.value;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
}

function handleResize(e: MouseEvent) {
    if (!isResizing.value) return;
    const deltaY = e.clientY - resizeStartY.value;
    const newHeight = Math.max(250, Math.min(800, resizeStartHeight.value + deltaY));
    chartSectionHeight.value = newHeight;
}

function stopResize() {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
}

// 为每个分类分配颜色
const categoryColors = ref<Record<string, string>>({
    work: "#f59e0b",
    entertainment: "#ec4899",
    study: "#3b82f6",
    exercise: "#22c55e",
    reading: "#8b5cf6",
    meeting: "#ef4444",
    "未分类": "#6b7280",
});

// 颜色池（用于自定义分类）
const colorPalette = [
    "#f59e0b", "#ec4899", "#3b82f6", "#22c55e", "#8b5cf6", "#ef4444",
    "#06b6d4", "#f97316", "#84cc16", "#a855f7", "#14b8a6", "#fb923c",
    "#10b981", "#6366f1", "#f43f5e", "#eab308", "#8b5cf6", "#059669"
];

// 为分类分配颜色（如果没有颜色则自动分配）
function ensureColorForCategory(category: string) {
    if (!categoryColors.value[category]) {
        // 为自定义分类分配颜色
        const existingColors = Object.values(categoryColors.value);
        const availableColor = colorPalette.find(color => !existingColors.includes(color)) 
            || colorPalette[Object.keys(categoryColors.value).length % colorPalette.length];
        categoryColors.value[category] = availableColor;
    }
    return categoryColors.value[category];
}

// 生成饼图路径
function generatePieChart() {
    if (categoryStatsWithPercentage.value.length === 0) return [];

    // 如果只有一个分类，直接绘制整个圆
    if (categoryStatsWithPercentage.value.length === 1) {
        const item = categoryStatsWithPercentage.value[0];
        return [{
            category: item.category,
            label: item.label,
            path: `M ${chartCenter} ${chartCenter} m -${chartRadius}, 0 a ${chartRadius},${chartRadius} 0 1,0 ${chartRadius * 2},0 a ${chartRadius},${chartRadius} 0 1,0 -${chartRadius * 2},0`,
            color: ensureColorForCategory(item.category),
            percentage: item.percentage,
            duration: item.duration,
        }];
    }

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
            color: ensureColorForCategory(item.category),
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
    return categoryLabels.value[category] || category;
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
async function handleClearAll() {
    if (records.value.length === 0) return;

    const confirmed = await confirm(
        `确定要清空所有 ${records.value.length} 条历史记录吗？此操作不可恢复。`,
        { title: "确认清空", kind: "warning" }
    );

    if (confirmed) {
        clearRecords();
    }
}

// 今日折线图数据（按小时统计）
const todayLineChartData = computed(() => {
    if (timeRange.value !== "today") return [];

    const hourlyData = new Array(24).fill(0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    filteredRecords.value.forEach(record => {
        const hour = new Date(record.endTime).getHours();
        hourlyData[hour] += record.duration / 1000 / 60; // 转换为分钟
    });

    return hourlyData;
});

// 本周柱状图数据（按天统计）
const weekBarChartData = computed(() => {
    if (timeRange.value !== "week") return [];

    const dailyData = new Array(7).fill(0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    filteredRecords.value.forEach(record => {
        const recordDate = new Date(record.endTime);
        const dayIndex = recordDate.getDay();
        dailyData[dayIndex] += record.duration / 1000 / 60; // 转换为分钟
    });

    return dailyData;
});

// 本月热力图数据（按日期统计）
const monthHeatmapData = computed(() => {
    if (timeRange.value !== "month") return [];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const dailyData = new Array(daysInMonth).fill(0);

    filteredRecords.value.forEach(record => {
        const recordDate = new Date(record.endTime);
        const dayIndex = recordDate.getDate() - 1;
        dailyData[dayIndex] += record.duration / 1000 / 60; // 转换为分钟
    });

    return dailyData;
});

// 生成折线图路径
function generateLineChartPath(): string {
    const data = todayLineChartData.value;
    if (data.length === 0 || data.every(v => v === 0)) return "";

    const width = 400;
    const height = 100;
    const maxValue = Math.max(...data, 1);
    const pointSpacing = width / (data.length - 1);

    const points = data.map((value, index) => {
        const x = index * pointSpacing;
        const y = height - (value / maxValue) * height;
        return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
}

// 生成柱状图数据
const barChartBars = computed(() => {
    const data = weekBarChartData.value;
    if (data.length === 0) return [];

    const maxValue = Math.max(...data, 1);
    const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

    return data.map((value, index) => ({
        label: weekDays[index],
        value,
        height: (value / maxValue) * 100,
    }));
});

// 生成热力图数据
const heatmapCells = computed(() => {
    const data = monthHeatmapData.value;
    if (data.length === 0) return [];

    const maxValue = Math.max(...data, 1);

    return data.map((value, index) => ({
        day: index + 1,
        value,
        intensity: value / maxValue,
    }));
});
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

    <!-- 顶部区域：方案 A：两列自适应 -->
    <div class="top-grid">

      <!-- 总时长卡片 -->
      <div class="summary-card">
        <div class="summary-label">总工作时长</div>
        <div class="summary-value">{{ formatDuration(totalDuration) }}</div>
        <div class="summary-count">{{ filteredRecords.length }} 次记录</div>
      </div>

      <!-- 小图表卡片 -->
      <div class="chart-card">
        <!-- 今日折线图 -->
        <svg
          v-if="timeRange === 'today' && todayLineChartData.some(v => v > 0)"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          class="line-chart"
        >
          <path
            :d="generateLineChartPath()"
            fill="none"
            stroke="#f59e0b"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

        <!-- 本周柱状图 -->
        <div
          v-if="timeRange === 'week' && weekBarChartData.some(v => v > 0)"
          class="bar-chart"
        >
          <div
            v-for="bar in barChartBars"
            :key="bar.label"
            class="bar-item"
          >
            <div class="bar-wrapper">
              <div class="bar" :style="{ height: bar.height + '%' }"></div>
            </div>
            <div class="bar-label">{{ bar.label.slice(1) }}</div>
          </div>
        </div>

        <!-- 本月热力图 -->
        <div
          v-if="timeRange === 'month' && monthHeatmapData.some(v => v > 0)"
          class="heatmap-chart"
        >
          <div
            v-for="cell in heatmapCells"
            :key="cell.day"
            class="heatmap-cell"
            :style="{ 
              backgroundColor: '#f59e0b',
              opacity: 0.2 + cell.intensity * 0.8 
            }"
            :title="`${cell.day}日: ${Math.round(cell.value)}分钟`"
          >
            {{ cell.day }}
          </div>
        </div>

        <div class="chart-label" v-if="timeRange !== 'all'">
          {{ timeRange === 'today'
              ? '24小时分布'
              : timeRange === 'week'
              ? '每日工作时长'
              : '本月工作热力' }}
        </div>
      </div>
    </div>

    <!-- 中间：饼图 + 图例 -->
    <div v-if="categoryStatsWithPercentage.length > 0" class="chart-section">

      <div class="chart-row">
        <!-- 饼图 -->
        <div class="pie-chart-container">
          <svg :width="220" :height="220">
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

        <!-- legend 列表 -->
        <div class="legend-list">
          <div
            v-for="item in categoryStatsWithPercentage"
            :key="item.category"
            class="legend-item"
            :class="{
              hovered: hoveredCategory === item.category,
              dimmed: hoveredCategory !== null && hoveredCategory !== item.category
            }"
            @mouseenter="hoveredCategory = item.category"
            @mouseleave="hoveredCategory = null"
          >
            <div
              class="legend-color"
              :style="{ backgroundColor: ensureColorForCategory(item.category) }"
            ></div>
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

      <div class="resize-handle" @mousedown="startResize">
        <div class="resize-indicator"></div>
      </div>
    </div>

    <!-- 没有数据 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>暂无数据</p>
    </div>

    <!-- 底部历史记录 -->
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
        <svg width="48" height="48" viewBox="0 0 24 24">
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
                🏷️ {{ getCategoryLabel(record.category || null) }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="delete-btn"
            @click="deleteRecord(record.id)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              ></path>
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
  gap: 16px;
  height: 100%;
}

/* 时间范围 */
.time-range-selector {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.range-btn {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.range-btn.active {
  background: var(--bg-card);
  color: var(--primary-color);
}

/* 顶部两列布局 */
.top-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.summary-card,
.chart-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-card {
  justify-content: center;
  text-align: center;
}

/* 总时长 */
.summary-label {
  font-size: 14px;
  color: var(--text-secondary);
}
.summary-value {
  font-size: 28px;
  font-weight: 600;
  color: #f59e0b;
  margin: 4px 0;
}
.summary-count {
  font-size: 12px;
  color: var(--text-muted);
}

/* 图表卡片内部 */
.chart-card {
  padding: 16px 12px;
}

.chart-label {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

/* 折线图 */
.line-chart {
  width: 100%;
  height: 100px;
  max-width: 400px;
}

/* 本周柱状图 */
.bar-chart {
  display: flex;
  gap: 10px;
  height: 100px;
  align-items: flex-end;
  padding: 0 20px;
}
.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bar-wrapper {
  width: 100%;
  height: 90px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar {
  width: 100%;
  max-width: 32px;
  background: #f59e0b;
  min-height: 4px;
  border-radius: 3px 3px 0 0;
  transition: all 0.2s;
}
.bar-item:hover .bar {
  background: #d97706;
  transform: scaleY(1.05);
  transform-origin: bottom;
}
.bar-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* 热力图 */
.heatmap-chart {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  padding: 8px;
  width: 100%;
  max-width: 400px;
}

.heatmap-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

.heatmap-cell:hover {
  transform: scale(1.1);
  z-index: 1;
}

/* 中间饼图区 */
.chart-section {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-row {
  display: flex;
  gap: 20px;
  align-items: center;
}

.pie-chart-container {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-chart-container svg {
  width: 220px;
  height: 220px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
}

.chart-slice {
  transition: opacity 0.2s, filter 0.2s;
  cursor: pointer;
  transform-origin: center;
}

.chart-slice.dimmed {
  opacity: 0.4;
}

.chart-slice.hovered {
  opacity: 1;
  filter: brightness(1.15);
}

/* 图例列表 */
.legend-list {
  flex: 1;
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 8px;
}

.legend-item {
  display: flex;
  background: var(--bg-secondary);
  padding: 10px;
  border-radius: 8px;
  gap: 10px;
  cursor: pointer;
  transition: 0.2s;
}
.legend-item.hovered {
  background: var(--bg-hover);
}
.legend-item.dimmed {
  opacity: 0.5;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 2px;
}

.legend-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-header {
  display: flex;
  justify-content: space-between;
}
.legend-label {
  font-size: 14px;
}
.legend-percentage {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}
.legend-duration {
  color: var(--text-secondary);
  font-size: 12px;
}

/* resize */
.resize-handle {
  height: 20px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 0 12px 12px;
  transition: background-color 0.2s;
  margin-top: 8px;
}

.resize-handle:hover {
  background-color: var(--bg-secondary);
}

.resize-indicator {
  width: 40px;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  transition: background-color 0.2s;
}

.resize-handle:hover .resize-indicator {
  background-color: var(--primary-color);
}

/* 底部历史记录 */
.records-section {
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

/* 历史记录项 */
.records-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
}

.record-item {
  display: flex;
  background: var(--bg-secondary);
  padding: 10px;
  border-radius: 8px;
  gap: 12px;
  align-items: center;
}

.record-indicator {
  width: 4px;
  height: 36px;
  border-radius: 2px;
}

.record-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.record-name {
  font-size: 13px;
  color: var(--text-secondary);
}

.record-duration {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.delete-btn {
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: var(--bg-hover);
  color: #ef4444;
}

.delete-btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.clear-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: var(--bg-secondary);
  color: #ef4444;
}

.empty-state,
.empty-state-records {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted);
  gap: 12px;
}

.empty-state svg,
.empty-state-records svg {
  stroke: var(--text-muted);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.empty-state p,
.empty-state-records p {
  font-size: 14px;
  margin: 0;
}

</style>
