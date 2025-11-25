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
import { useTimer } from "./composables/useTimer";
import { useSettings } from "./composables/useSettings";
import { watch } from "vue";

const showSettings = ref(false);
const { settings } = useSettings();

const timer = useTimer({
  workDurationMs:
    (settings.workDurationMinutes * 60 + settings.workDurationSeconds) * 1000,
  breakDurationMs:
    (settings.breakDurationMinutes * 60 + settings.breakDurationSeconds) * 1000,
  onWorkEnd: async () => {
    try {
      // 1. 窗口置顶并获取焦点
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(true);
      await win.setFocus();

      if (settings.enableworkSound) {
        const audio = new Audio("/notification-piano.mp3");
        audio.play();
      }
      
      // 2. 发送系统通知
      if (settings.enableNotification) {
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
      }
    } catch (e) {
      console.error("Failed to handle work end:", e);
    }
  },
  onBreakEnd: async () => {
    try {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(false);

      if (settings.enablerestSound) {
        const audio = new Audio("/notification-chime.mp3");
        audio.play();
      }
    } catch (e) {
      console.error("Failed to reset window top:", e);
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
      ((newWorkMin as number) * 60 + (newWorkSec as number)) * 1000,
      ((newBreakMin as number) * 60 + (newBreakSec as number)) * 1000
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
      @reset="timer.reset()"
      @skip-break="timer.skipBreak()"
    />

    <BreakOverlay
      :visible="breakVisible"
      :remaining-seconds="breakRemainingSeconds"
      @skip="timer.skipBreak()"
    />

    <SettingsDialog :visible="showSettings" @close="closeSettings" />
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