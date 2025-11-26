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
import { watch, onMounted, onBeforeUnmount } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "./utils/errorHandler";
import { minutesSecondsToMs } from "./utils/timeUtils";
import { playAudio, preloadAudio } from "./utils/audioPlayer";

const showSettings = ref(false);
const showCloseConfirm = ref(false);
const { settings } = useSettings();

// 存储事件监听器的清理函数
const unlistenFns = ref<UnlistenFn[]>([]);
// 存储 watch 的停止函数
const stopWatchers = ref<(() => void)[]>([]);

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
    // 1. 显示、置顶并获取焦点
    const win = getCurrentWindow();
    await safeExecute(async () => {
      // 先显示窗口（如果被隐藏）
      await win.show();
      // 然后置顶
      await win.setAlwaysOnTop(true);
      // 最后获取焦点
      await win.setFocus();
    }, "Show and focus window on work end");

    // 2. 播放提示音
    if (settings.enableworkSound) {
      await safeExecute(async () => {
        await playAudio("/notification-piano.mp3", 0.5);
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
        await playAudio("/notification-chime.mp3", 0.5);
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
  
  // 预加载音频文件
  preloadAudio(["/notification-piano.mp3", "/notification-chime.mp3"]);

  // 监听托盘菜单事件（保存清理函数）
  unlistenFns.value.push(
    await listen("tray-start", () => {
      console.log("[Tray] Start event received");
      timer.start();
    })
  );
  unlistenFns.value.push(
    await listen("tray-pause", () => {
      console.log("[Tray] Pause event received");
      timer.pause();
    })
  );
  unlistenFns.value.push(
    await listen("tray-reset", () => {
      console.log("[Tray] Reset event received");
      handleReset();
    })
  );
  unlistenFns.value.push(
    await listen("tray-settings", async () => {
      console.log("[Tray] Settings event received");
      await safeExecute(async () => {
        await appWindow.show();
        await appWindow.setFocus();
        showSettings.value = true;
      }, "Show settings from tray");
    })
  );

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

  // 同步托盘图标状态（保存停止函数）
  const stopTrayIconWatch = watch(
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
  stopWatchers.value.push(stopTrayIconWatch);

  // 监听悬浮窗开关，控制显示/隐藏
  const stopFloatingWindowWatch = watch(
    () => settings.enableFloatingWindow,
    (enabled) => {
      console.log("[FloatingWindow] Toggle:", enabled);
      safeInvoke("toggle_floating_window", { show: enabled });
    },
    { immediate: true }
  );
  stopWatchers.value.push(stopFloatingWindowWatch);

  // 监听悬浮窗大小变化，动态调整窗口尺寸
  const stopFloatingWindowSizeWatch = watch(
    () => [settings.floatingWindowWidth, settings.floatingWindowHeight],
    ([width, height]) => {
      if (settings.enableFloatingWindow) {
        console.log("[FloatingWindow] Resize to:", width, "x", height);
        safeInvoke("resize_floating_window", { 
          width: width as number, 
          height: height as number 
        });
        // 同步窗口尺寸到悬浮窗（用于自适应字体）
        safeExecute(async () => {
          await appWindow.emit("float-size-sync", { 
            width: width as number, 
            height: height as number 
          });
        }, "Sync window size to floating window");
      }
    },
    { immediate: true }
  );
  stopWatchers.value.push(stopFloatingWindowSizeWatch);

  // 监听悬浮窗字体大小变化，同步到悬浮窗（用户手动修改时）
  let isAdaptiveUpdate = false; // 标记是否为自适应更新
  const stopFloatingWindowFontSizeWatch = watch(
    () => settings.floatingWindowFontSize,
    (fontSize) => {
      if (settings.enableFloatingWindow && !isAdaptiveUpdate) {
        console.log("[FloatingWindow] Font size changed to:", fontSize);
        safeExecute(async () => {
          await appWindow.emit("float-font-size-sync", { fontSize });
        }, "Sync font size to floating window");
      }
      isAdaptiveUpdate = false; // 重置标记
    },
    { immediate: true }
  );
  stopWatchers.value.push(stopFloatingWindowFontSizeWatch);

  // 定期同步计时器状态到悬浮窗
  const syncFloatingWindowState = async () => {
    if (!settings.enableFloatingWindow) return;
    
    await safeExecute(async () => {
      await appWindow.emit("timer-state-sync", {
        mode: timer.mode.value,
        remainingMs: timer.remainingMs.value,
        isRunning: timer.isRunning.value,
      });
    }, "Sync timer state to floating window");
  };

  // 监听计时器状态变化，同步到悬浮窗
  const stopTimerStateWatch = watch(
    () => [timer.mode.value, timer.remainingMs.value, timer.isRunning.value],
    () => {
      syncFloatingWindowState();
    }
  );
  stopWatchers.value.push(stopTimerStateWatch);

  // 监听悬浮窗的控制事件
  unlistenFns.value.push(
    await listen("float-start", () => {
      console.log("[Float] Start event received");
      timer.start();
    })
  );
  unlistenFns.value.push(
    await listen("float-pause", () => {
      console.log("[Float] Pause event received");
      timer.pause();
    })
  );
  // 监听悬浮窗自适应字体大小变化，同步到设置
  unlistenFns.value.push(
    await listen<{ fontSize: number }>("float-adaptive-font-size", (event) => {
      console.log("[Float] Adaptive font size:", event.payload.fontSize);
      isAdaptiveUpdate = true; // 标记为自适应更新，避免触发watch
      settings.floatingWindowFontSize = event.payload.fontSize;
    })
  );

  // 初始同步一次状态
  await syncFloatingWindowState();
});

// 组件卸载时清理所有监听器
onBeforeUnmount(() => {
  console.log("[App] Cleaning up listeners and watchers...");
  
  // 清理事件监听器
  unlistenFns.value.forEach((unlisten) => {
    try {
      unlisten();
    } catch (error) {
      console.error("[App] Failed to unlisten:", error);
    }
  });
  unlistenFns.value = [];
  
  // 停止所有 watch
  stopWatchers.value.forEach((stop) => {
    try {
      stop();
    } catch (error) {
      console.error("[App] Failed to stop watcher:", error);
    }
  });
  stopWatchers.value = [];
  
  console.log("[App] Cleanup completed");
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