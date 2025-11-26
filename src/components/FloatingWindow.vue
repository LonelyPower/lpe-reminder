<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { formatTime } from "../utils/timeUtils";
import type { TimerMode } from "../composables/useTimer";

// 接收主窗口同步的状态
const mode = ref<TimerMode>("idle");
const remainingMs = ref(0);
const isRunning = ref(false);

// 拖拽功能相关状态（已移除，改用区域判断）

// 计算显示的时间
const displayTime = computed(() => formatTime(remainingMs.value));

// 根据状态显示颜色
const stateColor = computed(() => {
  if (mode.value === "break") return "#22c55e"; // 绿色 - 休息中
  if (mode.value === "work") {
    return isRunning.value ? "#f59e0b" : "#94a3b8"; // 橙色 - 工作中 / 灰色 - 已暂停
  }
  return "#3b82f6"; // 蓝色 - 空闲
});

// 左键单击：暂停/继续
async function handleClick() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");

  if (mainWindow) {
    if (mode.value === "idle") {
      // 空闲状态，点击开始工作
      await mainWindow.emit("float-start", {});
    } else if (mode.value === "work") {
      // 工作状态，暂停或继续
      if (isRunning.value) {
        await mainWindow.emit("float-pause", {});
      } else {
        await mainWindow.emit("float-start", {});
      }
    }
  }
}

// 右键菜单：创建一个新的独立窗口来显示菜单
async function handleContextMenu(e: MouseEvent) {
  e.preventDefault();

  // 创建简单的原生菜单，通过主窗口显示
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");

  if (mainWindow) {
    // 显示主窗口并打开设置（简化的右键操作）
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
  await listen<{ mode: TimerMode; remainingMs: number; isRunning: boolean }>(
    "timer-state-sync",
    (event) => {
      mode.value = event.payload.mode;
      remainingMs.value = event.payload.remainingMs;
      isRunning.value = event.payload.isRunning;
    }
  );
});
</script>

<template>
  <div class="floating-window" :style="{ '--border-color': stateColor }" @contextmenu="handleContextMenu">
    <div class="time-display" :style="{ color: stateColor }" @click="handleTimeClick">
      {{ displayTime }}
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
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  user-select: none;
  /* 使用inset阴影模拟边框效果 */
  box-shadow: inset 0 0 0 2px var(--border-color, #3b82f6);
  transition: box-shadow 0.3s ease;
  --border-color: #3b82f6;
  /* 确保圆角外部完全透明，避免阴影残留 */
  overflow: hidden;
}

.floating-window:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: inset 0 0 0 2px var(--border-color, #3b82f6);
}

.time-display {
  flex: 1;
  font-size: 18px;
  font-weight: bold;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  transition: color 0.3s ease;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}

.time-display:hover {
  background: rgba(0, 0, 0, 0.05);
}

.time-display:active {
  background: rgba(0, 0, 0, 0.1);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 100%;
  cursor: move;
  color: #9ca3af;
  transition: color 0.2s;
  border-radius: 4px;
}

.drag-handle:hover {
  color: #6b7280;
  background: rgba(0, 0, 0, 0.05);
}

.drag-handle:active {
  color: #4b5563;
  background: rgba(0, 0, 0, 0.1);
}
</style>
