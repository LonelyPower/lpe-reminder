<script setup lang="ts">
import { computed, ref } from "vue";
import { useTimerHistory } from "../composables/useTimerHistoryDB";

const { records } = useTimerHistory();

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
  flex: 1;
  overflow: hidden;
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
</style>
