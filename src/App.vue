<script setup lang="ts">
import { ref, computed } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import TimerPanel from "./components/TimerPanel.vue";
import BreakOverlay from "./components/BreakOverlay.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import CloseConfirmDialog from "./components/CloseConfirmDialog.vue";
import { useTimer } from "./composables/useTimer";
import { useSettings } from "./composables/useSettings";
import { watch, onMounted } from "vue";
import { listen } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "./utils/errorHandler";
import { minutesSecondsToMs } from "./utils/timeUtils";

const showSettings = ref(false);
const showCloseConfirm = ref(false);
const { settings } = useSettings();

const timer = useTimer({
  workDurationMs: minutesSecondsToMs(
    settings.workDurationMinutes,
    settings.workDurationSeconds
  ),
  breakDurationMs: minutesSecondsToMs(
    settings.breakDurationMinutes,
    settings.breakDurationSeconds
  ),
  onWorkEnd: async () => {
    // 1. 窗口置顶并获取焦点
    const win = getCurrentWindow();
    await safeExecute(async () => {
      await win.setAlwaysOnTop(true);
      await win.setFocus();
    }, "Set window always on top");

    // 2. 播放提示音
    if (settings.enableworkSound) {
      await safeExecute(async () => {
        const audio = new Audio("/notification-piano.mp3");
        await audio.play();
      }, "Play work end sound");
    }

    // 3. 发送系统通知
    if (settings.enableNotification) {
      await safeExecute(async () => {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }

        if (permissionGranted) {
          sendNotification({
            title: "休息时间到！",
            body: "工作辛苦了，起来活动一下吧！",
            sound: "default",
          });
        }
      }, "Send work end notification");
    }
  },
  onBreakEnd: async () => {
    // 1. 取消窗口置顶
    const win = getCurrentWindow();
    await safeExecute(async () => {
      await win.setAlwaysOnTop(false);
    }, "Cancel window always on top");

    // 2. 播放提示音
    if (settings.enablerestSound) {
      await safeExecute(async () => {
        const audio = new Audio("/notification-chime.mp3");
        await audio.play();
      }, "Play break end sound");
    }
  },
});

// 监听设置变化，动态更新计时器配置
watch(
  () => [
    settings.workDurationMinutes,
    settings.workDurationSeconds,
    settings.breakDurationMinutes,
    settings.breakDurationSeconds,
  ],
  ([newWorkMin, newWorkSec, newBreakMin, newBreakSec]) => {
    timer.updateDurations(
      minutesSecondsToMs(newWorkMin as number, newWorkSec as number),
      minutesSecondsToMs(newBreakMin as number, newBreakSec as number)
    );
  }
);

const breakVisible = computed(() => timer.mode.value === "break");
const breakRemainingSeconds = computed(() =>
  Math.max(0, Math.floor(timer.remainingMs.value / 1000))
);

function openSettings() {
  showSettings.value = true;
}

function closeSettings() {
  showSettings.value = false;
}

function handleReset() {
  // 强制从 settings 更新一次 duration，确保重置时使用最新配置
  timer.updateDurations(
    minutesSecondsToMs(settings.workDurationMinutes, settings.workDurationSeconds),
    minutesSecondsToMs(settings.breakDurationMinutes, settings.breakDurationSeconds)
  );
  timer.reset();
}

async function handleCloseConfirm(minimize: boolean, remember: boolean) {
  console.log("[CloseConfirm] minimize:", minimize, "remember:", remember);
  showCloseConfirm.value = false;
  
  if (remember) {
    settings.closeBehavior = minimize ? "minimize" : "quit";
    console.log("[CloseConfirm] Saved closeBehavior:", settings.closeBehavior);
  }

  if (minimize) {
    console.log("[CloseConfirm] Hiding window...");
    await safeExecute(async () => {
      await getCurrentWindow().hide();
      console.log("[CloseConfirm] Window hidden successfully");
    }, "Hide window on close");
  } else {
    console.log("[CloseConfirm] Exiting app...");
    await safeInvoke("app_exit");
    console.log("[CloseConfirm] App exit called");
  }
}

onMounted(async () => {
  const appWindow = getCurrentWindow();

  // 监听托盘菜单事件
  await listen("tray-start", () => {
    console.log("[Tray] Start event received");
    timer.start();
  });
  await listen("tray-pause", () => {
    console.log("[Tray] Pause event received");
    timer.pause();
  });
  await listen("tray-reset", () => {
    console.log("[Tray] Reset event received");
    handleReset();
  });
  await listen("tray-settings", async () => {
    console.log("[Tray] Settings event received");
    await safeExecute(async () => {
      await appWindow.show();
      await appWindow.setFocus();
      showSettings.value = true;
    }, "Show settings from tray");
  });

  // 处理窗口关闭请求
  await appWindow.onCloseRequested(async (event) => {
    console.log("[CloseRequested] Triggered, behavior:", settings.closeBehavior);
    event.preventDefault(); // 始终阻止默认行为
    
    const behavior = settings.closeBehavior;
    if (behavior === "quit") {
      console.log("[CloseRequested] Exiting app...");
      await safeInvoke("app_exit");
      console.log("[CloseRequested] App exit called");
      return;
    }
    if (behavior === "minimize") {
      console.log("[CloseRequested] Hiding window...");
      await safeExecute(async () => {
        await appWindow.hide();
        console.log("[CloseRequested] Window hidden successfully");
      }, "Hide window on close request");
      return;
    }

    // behavior === 'ask'
    console.log("[CloseRequested] Showing confirm dialog");
    showCloseConfirm.value = true;
  });

  // 同步托盘图标状态
  watch(
    () => [timer.mode.value, timer.isRunning.value],
    () => {
      let state = "idle";
      if (timer.mode.value === "work") {
        state = timer.isRunning.value ? "working" : "paused";
      } else if (timer.mode.value === "break") {
        state = "break";
      }
      console.log("[Tray] Updating icon state to:", state);
      safeInvoke("set_tray_icon", { state });
    },
    { immediate: true } // 立即执行一次，确保初始状态正确
  );
});
</script>

<template>
  <main class="app-root">
    <header class="app-header">
      <h1 class="app-title">护眼定时器（预览版）</h1>
      <button type="button" class="settings-btn" @click="openSettings">
        设置
      </button>
    </header>

    <TimerPanel
      :mode="timer.mode.value"
      :remaining-ms="timer.remainingMs.value"
      :cycle-count="timer.cycleCount.value"
      :total-duration-ms="timer.totalDurationMs.value"
      :is-running="timer.isRunning.value"
      @start="timer.start()"
      @pause="timer.pause()"
      @reset="handleReset"
      @skip-break="timer.skipBreak()"
    />

    <BreakOverlay
      :visible="breakVisible"
      :remaining-seconds="breakRemainingSeconds"
      @skip="timer.skipBreak()"
    />

    <SettingsDialog :visible="showSettings" @close="closeSettings" />
    <CloseConfirmDialog
      :visible="showCloseConfirm"
      @confirm="handleCloseConfirm"
    />
  </main>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  padding: 24px 16px 40px;
  background: radial-gradient(circle at top left, #e0f2fe, #f9fafb);
}

.app-header {
  max-width: 720px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-title {
  font-size: 20px;
}

.settings-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.settings-btn:hover {
  background: #f3f4f6;
}
</style>