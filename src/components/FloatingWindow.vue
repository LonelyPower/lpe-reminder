<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { formatTime } from "../utils/timeUtils";
import type { TimerMode } from "../composables/useTimer";
import ContextMenu from "./ContextMenu.vue";

// 接收主窗口同步的状态
const mode = ref<TimerMode>("idle");
const remainingMs = ref(0);
const isRunning = ref(false);

// 右键菜单状态
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

// 拖拽功能相关状态
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartWindowX = ref(0);
const dragStartWindowY = ref(0);

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

// 右键显示自定义菜单
async function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  
  contextMenuX.value = e.clientX;
  contextMenuY.value = e.clientY;
  showContextMenu.value = true;
}

// 菜单操作
async function handleMenuStart() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");
  if (mainWindow) {
    await mainWindow.emit("float-start", {});
  }
}

async function handleMenuPause() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");
  if (mainWindow) {
    await mainWindow.emit("float-pause", {});
  }
}

async function handleMenuReset() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");
  if (mainWindow) {
    await mainWindow.emit("tray-reset", {});
  }
}

async function handleMenuSettings() {
  const { getAllWindows } = await import("@tauri-apps/api/window");
  const windows = await getAllWindows();
  const mainWindow = windows.find((w) => w.label === "main");
  if (mainWindow) {
    await mainWindow.show();
    await mainWindow.setFocus();
    await mainWindow.emit("tray-settings", {});
  }
}

// 开始拖拽窗口
async function handleMouseDown(e: MouseEvent) {
  // 只处理左键
  if (e.button !== 0) return;
  
  const win = getCurrentWindow();
  
  // 记录拖拽开始时的鼠标位置和窗口位置
  dragStartX.value = e.screenX;
  dragStartY.value = e.screenY;
  
  const startPosition = await win.outerPosition();
  dragStartWindowX.value = startPosition.x;
  dragStartWindowY.value = startPosition.y;
  
  // 使用 Tauri 的内置拖拽功能
  try {
    await win.startDragging();
  } catch (error) {
    // 拖拽结束或被取消
  }
  
  // 拖拽结束后，检查窗口位置是否真的改变了
  const endPosition = await win.outerPosition();
  const windowMoved = Math.abs(endPosition.x - dragStartWindowX.value) > 3 || 
                      Math.abs(endPosition.y - dragStartWindowY.value) > 3;
  
  // 只有窗口没有移动时，才视为点击
  if (!windowMoved) {
    handleClick();
  }
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
  <div
    class="floating-window"
    :style="{ borderColor: stateColor }"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
  >
    <div class="time-display" :style="{ color: stateColor }">
      {{ displayTime }}
    </div>
  </div>

  <ContextMenu
    :visible="showContextMenu"
    :x="contextMenuX"
    :y="contextMenuY"
    :mode="mode"
    :is-running="isRunning"
    @start="handleMenuStart"
    @pause="handleMenuPause"
    @reset="handleMenuReset"
    @settings="handleMenuSettings"
    @close="showContextMenu = false"
  />
</template>

<style scoped>
.floating-window {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 3px solid;
  border-radius: 12px;
  cursor: move;
  user-select: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: border-color 0.3s ease;
}

.floating-window:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.time-display {
  font-size: 18px;
  font-weight: bold;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  transition: color 0.3s ease;
}
</style>
