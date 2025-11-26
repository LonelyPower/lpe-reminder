<template>
  <div
    class="floating-ball"
    :class="statusClass"
    @mousedown="startDrag"
    @click.left.stop="handleClick"
    @contextmenu.prevent="handleRightClick"
  >
    <div class="time-display">{{ displayTime }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window"
import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event"
import { Menu, PredefinedMenuItem } from "@tauri-apps/api/menu"
import { formatTime } from "../utils/timeUtils"

// 计时器状态
const mode = ref<"idle" | "work" | "break">("idle")
const isRunning = ref(false)
const remainingMs = ref(0)

// 计算显示的时间
const displayTime = computed(() => formatTime(remainingMs.value))

// 状态样式类
const statusClass = computed(() => {
  if (mode.value === "break") return "status-break"
  if (mode.value === "work") {
    return isRunning.value ? "status-working" : "status-paused"
  }
  return "status-idle"
})

// 拖拽相关
let isDragging = false
let offsetX = 0
let offsetY = 0

const startDrag = (e: MouseEvent) => {
  isDragging = true
  offsetX = e.clientX
  offsetY = e.clientY

  document.addEventListener("mousemove", onDrag)
  document.addEventListener("mouseup", stopDrag)
}

const onDrag = async (e: MouseEvent) => {
  if (!isDragging) return

  const dx = e.screenX - offsetX
  const dy = e.screenY - offsetY

  const win = getCurrentWindow()
  await win.setPosition(new PhysicalPosition(dx, dy))
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener("mousemove", onDrag)
  document.removeEventListener("mouseup", stopDrag)
}

// 左键点击：切换暂停/继续
const handleClick = async () => {
  if (mode.value === "idle" || mode.value === "break") return
  await emit("floating-ball-toggle")
}

// 右键菜单
const handleRightClick = async (e: MouseEvent) => {
  const items = await Menu.new({
    items: [
      {
        id: "reset",
        text: "重置计时器",
        action: () => emit("floating-ball-reset"),
      },
      {
        id: "skip",
        text: "跳过休息",
        enabled: mode.value === "break",
        action: () => emit("floating-ball-skip-break"),
      },
      await PredefinedMenuItem.new({ item: "Separator" }),
      {
        id: "settings",
        text: "打开设置",
        action: () => emit("floating-ball-open-settings"),
      },
    ],
  })

  await items.popup(new PhysicalPosition(e.clientX, e.clientY))
}

// 监听主窗口的计时器状态更新
let unlistenTimerUpdate: UnlistenFn | null = null

onMounted(async () => {
  // 监听计时器状态更新
  unlistenTimerUpdate = await listen<{
    mode: "idle" | "work" | "break"
    isRunning: boolean
    remainingMs: number
  }>("timer-update", (event) => {
    mode.value = event.payload.mode
    isRunning.value = event.payload.isRunning
    remainingMs.value = event.payload.remainingMs
  })

  // 请求初始状态
  await emit("floating-ball-ready")
})

onBeforeUnmount(() => {
  if (unlistenTimerUpdate) {
    unlistenTimerUpdate()
  }
  document.removeEventListener("mousemove", onDrag)
  document.removeEventListener("mouseup", stopDrag)
})
</script>

<style scoped>
.floating-ball {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  transition: border-color 0.3s ease, background 0.3s ease;
  border: 3px solid;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.status-idle {
  background: rgba(200, 200, 200, 0.8);
  border-color: #999;
}

.status-working {
  background: rgba(76, 175, 80, 0.8);
  border-color: #4caf50;
}

.status-paused {
  background: rgba(255, 152, 0, 0.8);
  border-color: #ff9800;
}

.status-break {
  background: rgba(33, 150, 243, 0.8);
  border-color: #2196f3;
}

.time-display {
  font-size: 14px;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
</style>
