<script setup lang="ts">
import { ref, computed } from "vue";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
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
import { useTimer } from "./composables/useTimer";
import { useStopwatch } from "./composables/useStopwatch";
import { useSettings } from "./composables/useSettingsDB";
import { useTimerHistory } from "./composables/useTimerHistoryDB";
import { watch, onMounted, onBeforeUnmount } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "./utils/errorHandler";
import { minutesSecondsToMs } from "./utils/timeUtils";
import { playAudio, preloadAudio } from "./utils/audioPlayer";
import { initDatabase, migrateFromLocalStorage, saveSetting } from "./utils/database";

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
    console.log("[Countdown] Work record saved:", workDuration, "ms");

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
    // 2. 播放提示音
    if (settings.enableworkSound) {
      await safeExecute(async () => {
        await playAudio("/notification-piano.mp3", 0.5);
      }, "Play work end sound");
    }


  },
  onBreakEnd: async () => {
    // 0. 保存休息记录（使用实际休息时长）
    const endTime = Date.now();
    const actualBreakDuration = timer.breakElapsedMs.value;
    addRecord({
      type: "countdown",
      mode: "break",
      startTime: endTime - actualBreakDuration,
      endTime: endTime,
      duration: actualBreakDuration,
    });
    console.log("[Countdown] Break record auto-saved:", actualBreakDuration, "ms");

    // 1. 播放提示音
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
  () => [stopwatch.elapsedMs.value, stopwatch.mode.value] as const,
  ([newElapsed, newMode], [oldElapsed, oldMode]) => {
    // 当 elapsedMs 从非零变为零，且在变化前是工作模式，且在变化后仍是工作模式（即调用了 stop()），显示对话框
    // 这样可以避免休息结束时（mode 变为 work）触发弹窗
    if ((oldElapsed as number) > 0 && (newElapsed as number) === 0 && oldMode === "work" && newMode === "work") {
      stopwatchWorkDuration.value = oldElapsed as number;
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

function openSettings() {
  showSettings.value = true;
}

function closeApp() {
  const win = getCurrentWindow();
  win.close();
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

// 处理倒计时休息结束（用户手动点击按钮）
async function handleCountdownBreakEnd() {
  // 取消窗口置顶
  const win = getCurrentWindow();
  await safeExecute(async () => {
    await win.setAlwaysOnTop(false);
  }, "Cancel window always on top");
  
  // 结束休息（休息记录已在 onBreakEnd 中自动保存）
  timer.skipBreak();
  console.log("[Countdown] Break ended manually by user");
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

  // 定义保存窗口尺寸的函数
  const saveWindowSize = async () => {
    try {
      const size = await appWindow.innerSize();
      const factor = await appWindow.scaleFactor();
      const logicalSize = size.toLogical(factor);
      
      settings.windowWidth = logicalSize.width;
      settings.windowHeight = logicalSize.height;
      
      await saveSetting("windowWidth", logicalSize.width.toString());
      await saveSetting("windowHeight", logicalSize.height.toString());
    } catch (e) {
      console.error("Failed to save window size", e);
    }
  };
  
  // 初始化数据库并迁移数据
  try {
    await initDatabase();
    console.log("✓ Database initialized");
    
    // 检查是否需要从 localStorage 迁移数据
    const hasOldData = localStorage.getItem("lpe-reminder-settings") || 
                       localStorage.getItem("lpe-reminder-history");
    if (hasOldData) {
      console.log("Found old localStorage data, starting migration...");
      await migrateFromLocalStorage();
    }

    // 恢复上次关闭时的窗口尺寸
    if (settings.windowWidth && settings.windowHeight) {
      try {
        await appWindow.setSize(new LogicalSize(settings.windowWidth, settings.windowHeight));
      } catch (e) {
        console.error("Failed to restore window size", e);
      }
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
  
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
  unlistenFns.value.push(
    await listen("tray-quit", async () => {
      console.log("[Tray] Quit event received");
      // 保存窗口尺寸
      await saveWindowSize();
      
      // 保存悬浮窗位置
      if (settings.enableFloatingWindow) {
          try {
            const pos = await safeInvoke<[number, number]>("get_floating_window_position");
            if (pos) {
               settings.floatingWindowX = pos[0];
               settings.floatingWindowY = pos[1];
               // 强制保存到数据库
               await saveSetting("floatingWindowX", pos[0].toString());
               await saveSetting("floatingWindowY", pos[1].toString());
            }
          } catch (e) {
            console.error("Failed to get floating window position", e);
          }
      }
      await safeInvoke("app_exit");
    })
  );

  // 处理窗口关闭请求
  await appWindow.onCloseRequested(async (event) => {
    console.log("[CloseRequested] Triggered, behavior:", settings.closeBehavior);
    event.preventDefault(); // 始终阻止默认行为
    
    // 保存窗口尺寸
    await saveWindowSize();

    // 保存悬浮窗位置
    if (settings.enableFloatingWindow) {
        try {
          const pos = await safeInvoke<[number, number]>("get_floating_window_position");
          if (pos) {
             settings.floatingWindowX = pos[0];
             settings.floatingWindowY = pos[1];
          }
        } catch (e) {
          console.error("Failed to get floating window position", e);
        }
    }

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
    async (enabled) => {
      console.log("[FloatingWindow] Toggle:", enabled);
      if (enabled) {
        // 恢复位置
        if (settings.floatingWindowX !== undefined && settings.floatingWindowY !== undefined) {
           await safeInvoke("move_floating_window", { 
             x: settings.floatingWindowX, 
             y: settings.floatingWindowY 
           });
        }
        safeInvoke("toggle_floating_window", { show: true });
      } else {
        // 保存位置
        try {
          const pos = await safeInvoke<[number, number]>("get_floating_window_position");
          if (pos) {
             settings.floatingWindowX = pos[0];
             settings.floatingWindowY = pos[1];
          }
        } catch (e) {
          console.error("Failed to get floating window position", e);
        }
        safeInvoke("toggle_floating_window", { show: false });
      }
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

  // 监听主题变化
  watch(
    () => settings.theme,
    (newTheme) => {
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else if (newTheme === 'light') {
        root.classList.remove('dark');
      } else {
        // System theme
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    },
    { immediate: true }
  );

  // 监听系统主题变化
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (settings.theme === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    });
  }

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
    <header class="app-header" data-tauri-drag-region>
      <h1 class="app-title" data-tauri-drag-region>LPE Reminder</h1>
      <div class="header-actions">
        <button type="button" class="icon-btn settings-btn" @click="openSettings" aria-label="设置">
          设置
        </button>
        <button type="button" class="icon-btn close-btn" @click="closeApp" aria-label="关闭">
          关闭
        </button>
      </div>
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
        :mode="timer.mode.value === 'break' ? 'idle' : timer.mode.value"
        :remaining-ms="timer.mode.value === 'break' ? minutesSecondsToMs(settings.workDurationMinutes, settings.workDurationSeconds) : timer.remainingMs.value"
        :cycle-count="timer.cycleCount.value"
        :total-duration-ms="timer.totalDurationMs.value"
        :is-running="timer.mode.value === 'break' ? false : timer.isRunning.value"
        @start="timer.start()"
        @pause="timer.pause()"
        @reset="handleReset"
        @skip-break="timer.skipBreak()"
      />

      <StopwatchPanel
        v-if="settings.timerMode === 'stopwatch'"
        :elapsed-ms="stopwatch.mode.value === 'break' ? 0 : stopwatch.elapsedMs.value"
        :is-running="stopwatch.mode.value === 'break' ? false : stopwatch.isRunning.value"
        @start="stopwatch.start()"
        @pause="stopwatch.pause()"
        @stop="stopwatch.stop()"
      />
    </div>

    <div v-show="activeTab === 'history'" class="tab-content">
      <HistoryPanel />
    </div>

    <!-- 倒计时休息遮罩 -->
    <BreakOverlay
      v-if="settings.timerMode === 'countdown'"
      :visible="breakVisible"
      :elapsed-ms="timer.breakElapsedMs.value"
      :target-ms="
        minutesSecondsToMs(
          settings.breakDurationMinutes,
          settings.breakDurationSeconds
        )
      "
      :is-countdown="true"
      @end="handleCountdownBreakEnd"
    />

    <!-- 正计时休息遮罩 -->
    <BreakOverlay
      v-if="settings.timerMode === 'stopwatch'"
      :visible="stopwatch.mode.value === 'break'"
      :elapsed-ms="stopwatch.elapsedMs.value"
      :target-ms="stopwatch.breakTargetMs.value"
      :is-countdown="false"
      @end="handleStopwatchBreakEnd"
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

<style>
:root {
  --bg-app: #F5F7F5;
  --bg-card: #FFFFFF;
  --bg-secondary: #E5E7EB;
  --bg-hover: #D1D5DB;
  --text-primary: #1F2937;
  --text-secondary: #4B5563;
  --text-muted: #9CA3AF;
  --primary-color: #059669;
  --primary-hover: #047857;
  --border-color: #E5E7EB;
  --shadow-color: rgba(0, 0, 0, 0.05);
  --overlay-bg: rgba(0, 0, 0, 0.3);
}

.dark {
  --bg-app: #111827;
  --bg-card: #1F2937;
  --bg-secondary: #374151;
  --bg-hover: #4B5563;
  --text-primary: #F9FAFB;
  --text-secondary: #D1D5DB;
  --text-muted: #9CA3AF;
  --primary-color: #10B981;
  --primary-hover: #059669;
  --border-color: #374151;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --overlay-bg: rgba(0, 0, 0, 0.6);
}

body {
  margin: 0;
  padding: 0;
  background: transparent;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden; /* 防止出现滚动条 */
}
</style>

<style scoped>
.app-root {
 height: 100vh;
  padding: 12px;
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
    border-radius: 16px; /* 圆角 */
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: background-color 0.3s, color 0.3s;
}

.app-header {
  max-width: 100%;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  position: relative;
  z-index: 50;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.025em;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0; /* Hide text, use icon if possible, or just keep text small */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-btn::before {
  content: "⚙️";
  font-size: 16px;
}

.close-btn::before {
  content: "✕";
  font-size: 16px;
}

.close-btn:hover {
  background: #FEE2E2;
  color: #EF4444;
}

.tabs {
  max-width: 100%;
  margin: 0 0 16px;
  display: flex;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 16px;
}

.tab-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--bg-card);
  color: var(--primary-color);
  box-shadow: 0 2px 4px var(--shadow-color);
  font-weight: 600;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  width: 100%;
}

.tab-content {
  animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>