<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { formatTime } from "../utils/timeUtils";

interface Props {
  mode: "idle" | "work" | "break";
  remainingMs: number;
  isRunning: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "reset"): void;
  (e: "skipBreak"): void;
  (e: "settings"): void;
}>();

// 悬浮球位置和拖拽状态
const ballRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const position = ref({ x: window.innerWidth - 120, y: 100 }); // 默认右上角
const dragStart = ref({ x: 0, y: 0 });
const showMenu = ref(false);

// 状态颜色和文字
const statusColor = computed(() => {
  if (props.mode === "break") return "#f59e0b"; // 橙色 - 休息中
  if (props.mode === "work") {
    return props.isRunning ? "#10b981" : "#6b7280"; // 绿色 - 工作中，灰色 - 暂停
  }
  return "#6b7280"; // 灰色 - 空闲
});

const statusText = computed(() => {
  if (props.mode === "break") return "休息";
  if (props.mode === "work") return props.isRunning ? "工作" : "暂停";
  return "空闲";
});

// 拖拽处理
function handleMouseDown(e: MouseEvent) {
  if (showMenu.value) return; // 显示菜单时不允许拖拽
  
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  };
  
  e.preventDefault();
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  
  const newX = e.clientX - dragStart.value.x;
  const newY = e.clientY - dragStart.value.y;
  
  // 限制在窗口范围内
  const maxX = window.innerWidth - 80;
  const maxY = window.innerHeight - 80;
  
  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY)),
  };
}

function handleMouseUp() {
  isDragging.value = false;
}

// 左键点击 - 切换暂停/继续
function handleClick(e: MouseEvent) {
  if (isDragging.value) return;
  if (e.button !== 0) return; // 只处理左键
  
  emit("toggle");
}

// 右键菜单
function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  showMenu.value = !showMenu.value;
}

function handleMenuAction(action: string) {
  showMenu.value = false;
  
  switch (action) {
    case "reset":
      emit("reset");
      break;
    case "skipBreak":
      emit("skipBreak");
      break;
    case "settings":
      emit("settings");
      break;
  }
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  if (showMenu.value && ballRef.value && !ballRef.value.contains(e.target as Node)) {
    showMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("click", handleClickOutside);
  
  // 从 localStorage 恢复位置
  const savedPosition = localStorage.getItem("floating-ball-position");
  if (savedPosition) {
    try {
      position.value = JSON.parse(savedPosition);
    } catch (e) {
      console.error("Failed to parse saved position:", e);
    }
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("click", handleClickOutside);
  
  // 保存位置
  localStorage.setItem("floating-ball-position", JSON.stringify(position.value));
});
</script>

<template>
  <div
    ref="ballRef"
    class="floating-ball"
    :class="{ dragging: isDragging }"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      borderColor: statusColor,
    }"
    @mousedown="handleMouseDown"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <div class="ball-content">
      <div class="time-display">{{ formatTime(remainingMs) }}</div>
      <div class="status-text" :style="{ color: statusColor }">
        {{ statusText }}
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <div v-if="showMenu" class="context-menu">
      <div class="menu-item" @click="handleMenuAction('reset')">
        重置计时
      </div>
      <div
        v-if="mode === 'break'"
        class="menu-item"
        @click="handleMenuAction('skipBreak')"
      >
        跳过休息
      </div>
      <div class="menu-item" @click="handleMenuAction('settings')">
        设置
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-ball {
  position: fixed;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: move;
  user-select: none;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid;
  transition: transform 0.2s, box-shadow 0.2s;
}

.floating-ball:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.floating-ball.dragging {
  cursor: grabbing;
  transform: scale(1.1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
}

.ball-content {
  text-align: center;
  pointer-events: none;
}

.time-display {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

.status-text {
  font-size: 11px;
  margin-top: 2px;
  font-weight: 500;
  opacity: 0.8;
}

.context-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  min-width: 120px;
  z-index: 10001;
  pointer-events: auto;
}

.menu-item {
  padding: 10px 16px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #f3f4f6;
}

.menu-item:active {
  background: #e5e7eb;
}
</style>
