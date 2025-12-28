<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { formatTime } from "../utils/timeUtils";
import type { TimerMode } from "../composables/useTimer";
import { useSettings } from "../composables/useSettingsDB";

const { settings } = useSettings();

// 接收主窗口同步的状态
const timerMode = ref<"countdown" | "stopwatch">("countdown");
const mode = ref<TimerMode>("idle");
const remainingMs = ref(0);
const elapsedMs = ref(0);
const isRunning = ref(false);
// 休息模式专用状态
const isBreakMode = ref(false);
const breakElapsedMs = ref(0);

// 显示控制设置
const showTimer = ref(settings.floatingWindowShowTimer);
const showState = ref(settings.floatingWindowShowState);

// 窗口尺寸（用于自适应字体）
const windowWidth = ref(settings.floatingWindowWidth);
const windowHeight = ref(settings.floatingWindowHeight);

// 计算自适应字体大小（基于窗口高度）
const fontSize = computed(() => {
  // 基准：50px 高度对应 18px 字体
  const baseHeight = 50;
  const baseFontSize = 18;
  
  // 根据窗口高度等比例缩放字体
  const scaleFactor = windowHeight.value / baseHeight;
  const adaptiveFontSize = Math.round(baseFontSize * scaleFactor);
  
  // 限制字体大小范围（最小 12px，最大 48px）
  return Math.max(12, Math.min(48, adaptiveFontSize));
});

// 拖拽功能相关状态（已移除，改用区域判断）

// 计算显示的时间
const displayTime = computed(() => {
  // 休息模式下，统一显示休息正计时
  if (isBreakMode.value) {
    return formatTime(breakElapsedMs.value);
  }
  
  // 工作模式：正计时显示 elapsedMs，倒计时显示 remainingMs
  if (timerMode.value === "stopwatch") {
    return formatTime(elapsedMs.value);
  }
  return formatTime(remainingMs.value);
});

// 根据状态返回 CSS 类名
const statusClass = computed(() => {
  // 统一处理休息模式
  if (isBreakMode.value) return "status-break";
  
  if (timerMode.value === "stopwatch") {
    // 正计时模式（工作状态）
    if (elapsedMs.value > 0 || isRunning.value) {
      return isRunning.value ? "status-working" : "status-paused";
    }
    return "status-idle";
  }
  // 倒计时模式（工作状态）
  if (mode.value === "work") {
    return isRunning.value ? "status-working" : "status-paused";
  }
  return "status-idle";
});

// 状态文本
const stateText = computed(() => {
  // 统一处理休息模式
  if (isBreakMode.value) return "休息中";
  
  if (timerMode.value === "stopwatch") {
    // 正计时模式（工作状态）
    if (elapsedMs.value === 0 && !isRunning.value) return "空闲";
    return isRunning.value ? "计时中" : "已暂停";
  }
  // 倒计时模式（工作状态）
  if (mode.value === "work") {
    return isRunning.value ? "工作中" : "已暂停";
  }
  return "空闲";
});

// 左键单击：休息模式下显示主窗口，工作模式下暂停/继续
async function handleClick() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");

  if (mainWindow) {
    // 休息模式下，点击显示主窗口（进入休息界面）
    if (isBreakMode.value) {
      await mainWindow.emit("float-show-main", {});
      return;
    }
    
    // 工作模式下，点击暂停/继续
    if (isRunning.value) {
      await mainWindow.emit("float-pause", {});
    } else {
      await mainWindow.emit("float-start", {});
    }
  }
}

// 右键单击：显示主窗口
async function handleRightClick(e: MouseEvent) {
  e.preventDefault();
  
  // 右键点击统一显示主窗口，不执行停止操作
  // 用户可以在主窗口或通过左键点击来控制计时器
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");

  if (mainWindow) {
    await mainWindow.show();
    await mainWindow.setFocus();
  }
}

// 拖拽手柄区域的鼠标按下事件
async function handleDragHandleMouseDown(e: MouseEvent) {
  // 只处理左键
  if (e.button !== 0) return;

  e.stopPropagation(); // 阻止事件冒泡

  const win = getCurrentWindow();

  // 使用 Tauri 的内置拖拽功能
  try {
    await win.startDragging();
  } catch (error) {
    // 拖拽结束或被取消
  }
}

// 时间显示区域的点击事件
function handleTimeClick() {
  handleClick();
}

const currentTheme = ref("system");

function applyTheme(theme: string) {
  currentTheme.value = theme;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // System
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

watch(() => settings.theme, (newTheme) => {
  if (newTheme) applyTheme(newTheme);
}, { immediate: true });

onMounted(async () => {
  const win = getCurrentWindow();

  // 设置窗口始终置顶
  await win.setAlwaysOnTop(true);

  // 监听系统主题变化
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (currentTheme.value === "system") {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  });

  // 监听主窗口同步的计时器状态
  await listen<any>(
    "timer-state-sync",
    (event) => {
      const payload = event.payload;
      timerMode.value = payload.timerMode || "countdown";
      
      // 同步主题
      if (payload.theme) {
        applyTheme(payload.theme);
      }

      // 同步休息模式状态（统一处理）
      isBreakMode.value = payload.isBreakMode || false;
      breakElapsedMs.value = payload.breakElapsedMs || 0;

      if (payload.timerMode === "stopwatch") {
        elapsedMs.value = payload.elapsedMs || 0;
        isRunning.value = payload.isRunning || false;
        mode.value = payload.mode || "work";
      } else {
        mode.value = payload.mode || "idle";
        remainingMs.value = payload.remainingMs || 0;
        isRunning.value = payload.isRunning || false;
      }
    }
  );

  // 监听窗口尺寸变化（用于自适应字体）
  await listen<{ width: number; height: number }>(
    "float-size-sync",
    (event) => {
      windowWidth.value = event.payload.width;
      windowHeight.value = event.payload.height;
    }
  );

  // 监听显示设置变化
  await listen<{ showTimer: boolean; showState: boolean; theme?: string }>(
    "float-display-settings-sync",
    (event) => {
      showTimer.value = event.payload.showTimer;
      showState.value = event.payload.showState;
      if (event.payload.theme) {
        applyTheme(event.payload.theme);
      }
    }
  );
});
</script>

<template>
  <div class="floating-window" :class="statusClass" @contextmenu="handleRightClick">
    <div class="time-display" :style="{ fontSize: fontSize + 'px' }" @click="handleTimeClick">
      <div v-if="showTimer" class="time-text">{{ displayTime }}</div>
      <div v-if="showState" class="state-text">{{ stateText }}</div>
    </div>
    <div class="drag-handle" @mousedown="handleDragHandleMouseDown" title="拖动窗口">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="6" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="18" r="1" />
        <circle cx="15" cy="6" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="18" r="1" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.floating-window {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  background: var(--bg-card);
  border-radius: 12px;
  user-select: none;
  border: 2px solid var(--border-color);
  overflow: hidden;
  transition: all 0.3s ease;
}

.floating-window:hover {
  /* transform: translateY(-1px); 移除上跳效果以防止上边框被窗口裁剪 */
}

.time-display {
  flex: 1;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-weight: 700;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  transition: color 0.3s ease;
  cursor: pointer;
  overflow: hidden;
  text-align: center;
}

.time-text {
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

.state-text {
  font-size: 0.5em;
  opacity: 0.8;
  font-weight: 500;
  font-family: system-ui, -apple-system, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  flex-shrink: 0;
  height: 100%;
  cursor: move;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.drag-handle:hover {
  color: var(--text-primary);
}

.drag-handle:active {
  color: var(--text-primary);
}

/* 状态颜色定义 */
.floating-window.status-working,
.floating-window.status-break {
  color: var(--status-working-color);
  border-color: var(--status-working-color);
}

.floating-window.status-paused {
  color: var(--status-paused-color);
  border-color: var(--status-paused-color);
}

.floating-window.status-idle {
  color: var(--status-idle-color);
  border-color: var(--status-idle-color);
}
</style>
