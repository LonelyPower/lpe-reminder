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
import { PredefinedMenuItem } from "@tauri-apps/api/menu"
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
let startX = 0
let startY = 0
let windowX = 0
let windowY = 0
let lastUpdateTime = 0

const startDrag = async (e: MouseEvent) => {
  e.preventDefault()
  isDragging = true
  startX = e.screenX
  startY = e.screenY
  
  // 获取当前窗口位置
  const win = getCurrentWindow()
  const position = await win.outerPosition()
  windowX = position.x
  windowY = position.y
  
  console.log("[FloatingBall] Drag started at", { startX, startY, windowX, windowY })

  document.addEventListener("mousemove", onDrag)
  document.addEventListener("mouseup", stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging) return

  // 节流：每16ms更新一次（约60fps）
  const now = Date.now()
  if (now - lastUpdateTime < 16) return
  lastUpdateTime = now

  // 计算鼠标移动的距离
  const deltaX = e.screenX - startX
  const deltaY = e.screenY - startY

  // 计算新的窗口位置
  const newX = windowX + deltaX
  const newY = windowY + deltaY

  // 异步更新窗口位置（不阻塞事件处理）
  const win = getCurrentWindow()
  win.setPosition(new PhysicalPosition(newX, newY)).catch((err) => {
    console.error("[FloatingBall] Failed to set position:", err)
  })
}

const stopDrag = () => {
  console.log("[FloatingBall] Drag stopped")
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
  try {
    const { Menu: MenuClass, MenuItem } = await import("@tauri-apps/api/menu")
    
    const resetItem = await MenuItem.new({
      id: "reset",
      text: "重置计时器",
      action: () => emit("floating-ball-reset"),
    })
    
    const skipItem = await MenuItem.new({
      id: "skip",
      text: "跳过休息",
      enabled: mode.value === "break",
      action: () => emit("floating-ball-skip-break"),
    })
    
    const separator = await PredefinedMenuItem.new({ item: "Separator" })
    
    const settingsItem = await MenuItem.new({
      id: "settings",
      text: "打开设置",
      action: () => emit("floating-ball-open-settings"),
    })
    
    const menu = await MenuClass.new({
      items: [resetItem, skipItem, separator, settingsItem],
    })

    await menu.popup(new PhysicalPosition(e.screenX, e.screenY))
  } catch (error) {
    console.error("[FloatingBall] Failed to show context menu:", error)
  }
}

// 监听主窗口的计时器状态更新
let unlistenTimerUpdate: UnlistenFn | null = null

onMounted(async () => {
  console.log("[FloatingBall] Component mounted")
  
  // 监听计时器状态更新
  unlistenTimerUpdate = await listen<{
    mode: "idle" | "work" | "break"
    isRunning: boolean
    remainingMs: number
  }>("timer-update", (event) => {
    console.log("[FloatingBall] Timer update received:", event.payload)
    mode.value = event.payload.mode
    isRunning.value = event.payload.isRunning
    remainingMs.value = event.payload.remainingMs
  })

  // 请求初始状态
  console.log("[FloatingBall] Requesting initial state")
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
