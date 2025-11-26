<script setup lang="ts">
import { ref, computed } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import TimerPanel from "./components/TimerPanel.vue";
import StopwatchPanel from "./components/StopwatchPanel.vue";
import BreakOverlay from "./components/BreakOverlay.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import CloseConfirmDialog from "./components/CloseConfirmDialog.vue";
import HistoryPanel from "./components/HistoryPanel.vue";
import StopwatchCompleteDialog from "./components/StopwatchCompleteDialog.vue";
import StopwatchBreakOverlay from "./components/StopwatchBreakOverlay.vue";
import { useTimer } from "./composables/useTimer";
import { useStopwatch } from "./composables/useStopwatch";
import { useSettings } from "./composables/useSettings";
import { useTimerHistory } from "./composables/useTimerHistory";
import { watch, onMounted, onBeforeUnmount } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "./utils/errorHandler";
import { minutesSecondsToMs } from "./utils/timeUtils";
import { playAudio, preloadAudio } from "./utils/audioPlayer";

const showSettings = ref(false);
const showCloseConfirm = ref(false);
const { settings } = useSettings();
const { addRecord } = useTimerHistory();

// 选项卡状态
const activeTab = ref<"timer" | "history">("timer");

// 正计时相关状态
const showStopwatchComplete = ref(false);
const stopwatchWorkDuration = ref(0); // 保存工作时长用于对话框

// 存储事件监听器的清理函数
const unlistenFns = ref<UnlistenFn[]>([]);
// 存储 watch 的停止函数
const stopWatchers = ref<(() => void)[]>([]);

// 倒计时器
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
    // 0. 保存工作记录
    const endTime = Date.now();
    const workDuration = minutesSecondsToMs(
      settings.workDurationMinutes,
      settings.workDurationSeconds
    );
    addRecord({
      type: "countdown",
      mode: "work",
      startTime: endTime - workDuration,
      endTime: endTime,
      duration: workDuration,
    });

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
    // 0. 保存休息记录
    const endTime = Date.now();
    const breakDuration = minutesSecondsToMs(
      settings.breakDurationMinutes,
      settings.breakDurationSeconds
    );
    addRecord({
      type: "countdown",
      mode: "break",
      startTime: endTime - breakDuration,
      endTime: endTime,
      duration: breakDuration,
    });

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

// 正计时器
const stopwatch = useStopwatch({
  onBreakEnd: async () => {
    // 休息结束提示
    if (settings.enablerestSound) {
      await safeExecute(async () => {
        await playAudio("/notification-chime.mp3", 0.5);
      }, "Play stopwatch break end sound");
    }
  },
});

// 监听正计时停止，显示完成对话框
watch(
  () => stopwatch.elapsedMs.value,
  (newElapsed, oldElapsed) => {
    // 当 elapsedMs 从非零变为零且不是休息模式（即调用了 stop()），显示对话框
    if (oldElapsed > 0 && newElapsed === 0 && stopwatch.mode.value === "work") {
      stopwatchWorkDuration.value = oldElapsed;
      showStopwatchComplete.value = true;
      console.log("[Stopwatch] Work completed:", oldElapsed, "ms");
    }
  }
);

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

// 处理正计时完成
function handleStopwatchComplete(data: { name: string; takeBreak: boolean }) {
  showStopwatchComplete.value = false;
  
  const endTime = Date.now();
  const workDuration = stopwatchWorkDuration.value;
  
  // 保存工作记录
  addRecord({
    type: "stopwatch",
    mode: "work",
    name: data.name,
    startTime: endTime - workDuration,
    endTime: endTime,
    duration: workDuration,
  });
  console.log("[Stopwatch] Work record saved:", data.name, workDuration, "ms");
  
  // 如果需要休息，开始休息倒计时
  if (data.takeBreak) {
    const breakDuration = minutesSecondsToMs(
      settings.stopwatchBreakMinutes,
      settings.stopwatchBreakSeconds
    );
    stopwatch.startBreak(breakDuration);
    console.log("[Stopwatch] Break started:", breakDuration, "ms");
  }
}

// 处理正计时休息结束
function handleStopwatchBreakEnd() {
  const endTime = Date.now();
  const breakDuration = stopwatch.elapsedMs.value;
  
  // 保存休息记录
  addRecord({
    type: "stopwatch",
    mode: "break",
    startTime: endTime - breakDuration,
    endTime: endTime,
    duration: breakDuration,
  });
  console.log("[Stopwatch] Break record saved:", breakDuration, "ms");
  
  stopwatch.endBreak();
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
      if (settings.timerMode === "countdown") {
        timer.start();
      } else {
        stopwatch.start();
      }
    })
  );
  unlistenFns.value.push(
    await listen("tray-pause", () => {
      console.log("[Tray] Pause event received");
      if (settings.timerMode === "countdown") {
        timer.pause();
      } else {
        stopwatch.pause();
      }
    })
  );
  unlistenFns.value.push(
    await listen("tray-reset", () => {
      console.log("[Tray] Reset/Stop event received");
      if (settings.timerMode === "countdown") {
        handleReset();
      } else {
        stopwatch.stop();
      }
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
  // 使用 computed 避免频繁触发
  const trayIconState = computed(() => {
    let state = "idle";
    if (settings.timerMode === "countdown") {
      if (timer.mode.value === "work") {
        state = timer.isRunning.value ? "working" : "paused";
      } else if (timer.mode.value === "break") {
        state = "break";
      }
    } else {
      // 正计时模式
      if (stopwatch.mode.value === "break") {
        state = "break"; // 休息中
      } else if (stopwatch.elapsedMs.value > 0 || stopwatch.isRunning.value) {
        state = stopwatch.isRunning.value ? "working" : "paused";
      }
    }
    return state;
  });

  const stopTrayIconWatch = watch(
    trayIconState,
    (state) => {
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

  // 监听悬浮窗显示设置变化
  const stopFloatingWindowDisplayWatch = watch(
    () => [settings.floatingWindowShowTimer, settings.floatingWindowShowState],
    ([showTimer, showState]) => {
      if (settings.enableFloatingWindow) {
        console.log("[FloatingWindow] Display settings:", { showTimer, showState });
        safeExecute(async () => {
          await appWindow.emit("float-display-settings-sync", { 
            showTimer: showTimer as boolean, 
            showState: showState as boolean 
          });
        }, "Sync display settings to floating window");
      }
    },
    { immediate: true }
  );
  stopWatchers.value.push(stopFloatingWindowDisplayWatch);

  // 定期同步计时器状态到悬浮窗
  const syncFloatingWindowState = async () => {
    if (!settings.enableFloatingWindow) return;
    
    await safeExecute(async () => {
      if (settings.timerMode === "countdown") {
        await appWindow.emit("timer-state-sync", {
          mode: timer.mode.value,
          remainingMs: timer.remainingMs.value,
          isRunning: timer.isRunning.value,
          timerMode: "countdown",
        });
      } else {
        await appWindow.emit("timer-state-sync", {
          mode: stopwatch.mode.value, // work 或 break
          elapsedMs: stopwatch.elapsedMs.value,
          isRunning: stopwatch.isRunning.value,
          timerMode: "stopwatch",
        });
      }
    }, "Sync timer state to floating window");
  };

  // 监听计时器状态变化，同步到悬浮窗
  const stopTimerStateWatch = watch(
    () => [
      settings.timerMode,
      timer.mode.value, 
      timer.remainingMs.value, 
      timer.isRunning.value,
      stopwatch.mode.value,
      stopwatch.elapsedMs.value,
      stopwatch.isRunning.value
    ],
    () => {
      syncFloatingWindowState();
    }
  );
  stopWatchers.value.push(stopTimerStateWatch);

  // 监听悬浮窗的控制事件
  unlistenFns.value.push(
    await listen("float-start", () => {
      console.log("[Float] Start event received");
      if (settings.timerMode === "countdown") {
        timer.start();
      } else {
        stopwatch.start();
      }
    })
  );
  unlistenFns.value.push(
    await listen("float-pause", () => {
      console.log("[Float] Pause event received");
      if (settings.timerMode === "countdown") {
        timer.pause();
      } else {
        stopwatch.pause();
      }
    })
  );
  unlistenFns.value.push(
    await listen("float-stop", () => {
      console.log("[Float] Stop event received");
      if (settings.timerMode === "stopwatch") {
        stopwatch.stop();
      }
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

    <div class="tabs">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'timer' }"
        @click="activeTab = 'timer'"
      >
        计时器
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        历史记录
      </button>
    </div>

    <div v-show="activeTab === 'timer'" class="tab-content">
      <TimerPanel
        v-if="settings.timerMode === 'countdown'"
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

      <StopwatchPanel
        v-if="settings.timerMode === 'stopwatch'"
        :elapsed-ms="stopwatch.elapsedMs.value"
        :is-running="stopwatch.isRunning.value"
        @start="stopwatch.start()"
        @pause="stopwatch.pause()"
        @stop="stopwatch.stop()"
      />
    </div>

    <div v-show="activeTab === 'history'" class="tab-content">
      <HistoryPanel />
    </div>

    <BreakOverlay
      :visible="breakVisible"
      :remaining-seconds="breakRemainingSeconds"
      @skip="timer.skipBreak()"
    />

    <StopwatchBreakOverlay
      :visible="stopwatch.mode.value === 'break'"
      :elapsed-ms="stopwatch.elapsedMs.value"
      :target-ms="stopwatch.breakTargetMs.value"
      @end="handleStopwatchBreakEnd"
      @skip="stopwatch.skipBreak()"
    />

    <SettingsDialog :visible="showSettings" @close="closeSettings" />
    <CloseConfirmDialog
      :visible="showCloseConfirm"
      @confirm="handleCloseConfirm"
      @cancel="showCloseConfirm = false"
    />
    <StopwatchCompleteDialog
      :visible="showStopwatchComplete"
      :elapsed-ms="stopwatchWorkDuration"
      @confirm="handleStopwatchComplete"
      @cancel="showStopwatchComplete = false"
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

.tabs {
  max-width: 720px;
  margin: 0 auto 20px;
  display: flex;
  gap: 8px;
  padding: 4px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f9fafb;
  color: #374151;
}

.tab-btn.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>