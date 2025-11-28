<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { formatTime } from "../utils/timeUtils";
import type { TimerMode } from "../composables/useTimer";
import { useSettings } from "../composables/useSettings";

const { settings } = useSettings();

// 接收主窗口同步的状态
const timerMode = ref<"countdown" | "stopwatch">("countdown");
const mode = ref<TimerMode>("idle");
const remainingMs = ref(0);
const elapsedMs = ref(0);
const isRunning = ref(false);

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
  if (timerMode.value === "stopwatch") {
    return formatTime(elapsedMs.value);
  }
  return formatTime(remainingMs.value);
});

// 根据状态显示颜色
const stateColor = computed(() => {
  if (timerMode.value === "stopwatch") {
    // 正计时模式
    if (mode.value === "break") return "#059669"; // 绿色 - 休息中
    if (elapsedMs.value > 0 || isRunning.value) {
      return isRunning.value ? "#059669" : "#9CA3AF"; // 绿色 - 计时中 / 灰色 - 暂停
    }
    return "#6B7280"; // 灰色 - 空闲
  }
  // 倒计时模式
  if (mode.value === "break") return "#059669"; // 绿色 - 休息中
  if (mode.value === "work") {
    return isRunning.value ? "#059669" : "#9CA3AF"; // 绿色 - 工作中 / 灰色 - 已暂停
  }
  return "#6B7280"; // 灰色 - 空闲
});

// 状态文本
const stateText = computed(() => {
  if (timerMode.value === "stopwatch") {
    // 正计时模式
    if (mode.value === "break") return "休息中";
    if (elapsedMs.value === 0 && !isRunning.value) return "空闲";
    return isRunning.value ? "计时中" : "已暂停";
  }
  // 倒计时模式
  if (mode.value === "break") return "休息中";
  if (mode.value === "work") {
    return isRunning.value ? "工作中" : "已暂停";
  }
  return "空闲";
});

// 左键单击：暂停/继续
async function handleClick() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");

  if (mainWindow) {
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

onMounted(async () => {
  const win = getCurrentWindow();

  // 设置窗口始终置顶
  await win.setAlwaysOnTop(true);

  // 监听主窗口同步的计时器状态
  await listen<any>(
    "timer-state-sync",
    (event) => {
      const payload = event.payload;
      timerMode.value = payload.timerMode || "countdown";
      
      if (payload.timerMode === "stopwatch") {
        elapsedMs.value = payload.elapsedMs || 0;
        isRunning.value = payload.isRunning || false;
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
  await listen<{ showTimer: boolean; showState: boolean }>(
    "float-display-settings-sync",
    (event) => {
      showTimer.value = event.payload.showTimer;
      showState.value = event.payload.showState;
    }
  );
});
</script>

<template>
  <div class="floating-window" :style="{ '--border-color': stateColor }" @contextmenu="handleRightClick">
    <div class="time-display" :style="{ color: stateColor, fontSize: fontSize + 'px' }" @click="handleTimeClick">
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
  background: #FFFFFF;
  border-radius: 12px;
  user-select: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #E5E7EB;
  overflow: hidden;
  transition: all 0.3s ease;
}

.floating-window:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.time-display {
  flex: 1;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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
  color: #9CA3AF;
  transition: color 0.2s;
}

.drag-handle:hover {
  color: #6B7280;
}

.drag-handle:active {
  color: #4B5563;
}
</style>
