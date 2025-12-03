<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Components
import TimerPanel from "./components/Page_Timer.vue";
import StatisticsPanel from "./components/Page_Statistics.vue";
import StopwatchPanel from "./components/Page_Stopwatch.vue";
import BreakOverlay from "./components/Dialog_Break.vue";
import SettingsDialog from "./components/Dialog_Settings.vue";
import CloseConfirmDialog from "./components/Dialog_CloseConfirm.vue";
import StopwatchCompleteDialog from "./components/Dialog_StopwatchComplete.vue";

// Composables
import { useTimer } from "./composables/useTimer";
import { useStopwatch } from "./composables/useStopwatch";
import { useSettings } from "./composables/useSettingsDB";
import { useTimerHistory } from "./composables/useTimerHistoryDB";
import { useAppLifecycle } from "./composables/useAppLifecycle";
import { useWindowState } from "./composables/useWindowState";
import { useWindowClose } from "./composables/useWindowClose";
import { useTraySync } from "./composables/useTraySync";
import { useFloatingWindow } from "./composables/useFloatingWindow";
import { useTheme } from "./composables/useTheme";
import { useTimerHandlers } from "./composables/useTimerHandlers";

// Utils
import { minutesSecondsToMs } from "./utils/timeUtils";

// ==================== 状态 ====================
const activeTab = ref<"timer" | "statistics">("timer");
const showSettings = ref(false);

// ==================== Composables ====================
const { settings, init: initSettings, save: saveSettingsToDB } = useSettings();
const { addRecord } = useTimerHistory();

// 初始化计时器（不带回调，稍后通过 setupTimerCallbacks 设置）
const timer = useTimer({
  workDurationMs: minutesSecondsToMs(
    settings.workDurationMinutes,
    settings.workDurationSeconds
  ),
  breakDurationMs: minutesSecondsToMs(
    settings.breakDurationMinutes,
    settings.breakDurationSeconds
  ),
});

const stopwatch = useStopwatch();

// 计时器业务逻辑处理器
const {
  currentCountdownCategory,
  showStopwatchComplete,
  stopwatchWorkDuration,
  setupTimerCallbacks,
  setupStopwatchWatcher,
  handleCountdownBreakEnd,
  handleStopwatchBreakEnd,
  handleStopwatchComplete,
} = useTimerHandlers(settings, timer, stopwatch, addRecord);

// 窗口状态管理
const {
  saveWindowState,
  handleDialogOpen,
  handleDialogClose,
  handleSettingsOpen,
  handleSettingsClose,
  setupTabSwitchWatcher,
} = useWindowState(activeTab, settings);

// 悬浮窗管理
const floatingWindow = useFloatingWindow(settings, timer, stopwatch);

// 窗口关闭逻辑
const { showCloseConfirm, setupCloseHandler, handleCloseConfirm } =
  useWindowClose(
    settings,
    saveWindowState,
    floatingWindow.saveFloatingWindowPosition,
    saveSettingsToDB
  );

// 托盘同步
const traySync = useTraySync(settings, timer, stopwatch, {
  onReset: handleReset,
  onSettings: () => {
    showSettings.value = true;
  },
  onQuit: async () => {
    await saveWindowState();
    await floatingWindow.saveFloatingWindowPosition(true);
  },
});

// 主题管理
const { setupThemeWatcher } = useTheme(settings);

// 应用生命周期
const { initialize } = useAppLifecycle(settings, activeTab, initSettings);

// ==================== 计算属性 ====================
const breakOverlayVisible = computed(() => {
  if (settings.timerMode === "countdown") {
    return timer.mode.value === "break";
  } else {
    return stopwatch.mode.value === "break";
  }
});

const breakOverlayElapsed = computed(() => {
  if (settings.timerMode === "countdown") {
    return timer.breakElapsedMs.value;
  } else {
    return stopwatch.elapsedMs.value;
  }
});

const breakOverlayTarget = computed(() => {
  if (settings.timerMode === "countdown") {
    return minutesSecondsToMs(
      settings.breakDurationMinutes,
      settings.breakDurationSeconds
    );
  } else {
    return stopwatch.breakTargetMs.value;
  }
});

const isCountdownMode = computed(() => settings.timerMode === "countdown");

// ==================== 事件处理 ====================
async function openSettings() {
  showSettings.value = true;
  await handleSettingsOpen();
}

async function closeSettings() {
  showSettings.value = false;
  await handleSettingsClose();
}

function closeApp() {
  getCurrentWindow().close();
}

async function handleBreakOverlayEnd() {
  if (settings.timerMode === "countdown") {
    await handleCountdownBreakEnd();
  } else {
    await handleStopwatchBreakEnd();
  }
}

function handleReset() {
  timer.updateDurations(
    minutesSecondsToMs(
      settings.workDurationMinutes,
      settings.workDurationSeconds
    ),
    minutesSecondsToMs(
      settings.breakDurationMinutes,
      settings.breakDurationSeconds
    )
  );
  timer.reset();
}

// ==================== 生命周期 ====================
const cleanupFunctions = ref<Array<() => void>>([]);

onMounted(async () => {
  // 1. 初始化应用（数据库、窗口状态等）
  await initialize();

  // 2. 设置计时器回调
  setupTimerCallbacks();

  // 3. 启动各种监听和同步
  cleanupFunctions.value.push(
    setupStopwatchWatcher(),
    traySync.startTrayIconSync(),
    floatingWindow.setupFloatingWindowSync(),
    setupThemeWatcher(),
    setupTabSwitchWatcher()
  );

  // 4. 设置事件监听器
  await Promise.all([
    traySync.setupTrayListeners(),
    floatingWindow.setupFloatingWindowListeners(),
    setupCloseHandler(),
  ]);

  // 5. 监听设置变化更新计时器
  const stopDurationWatch = watch(
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
  cleanupFunctions.value.push(stopDurationWatch);

  // 6. 监听关闭确认 Dialog 显示状态，调整窗口大小
  const stopCloseConfirmWatch = watch(
    () => showCloseConfirm.value,
    async (show) => {
      if (show) {
        await handleDialogOpen(400); // CloseConfirmDialog 宽度 400px
      } else {
        await handleDialogClose();
      }
    }
  );
  cleanupFunctions.value.push(stopCloseConfirmWatch);

  // 7. 监听秒表完成 Dialog 显示状态，调整窗口大小
  const stopStopwatchCompleteWatch = watch(
    () => showStopwatchComplete.value,
    async (show) => {
      if (show) {
        await handleDialogOpen(480); // StopwatchComplete Dialog 使用默认宽度 480px
      } else {
        await handleDialogClose();
      }
    }
  );
  cleanupFunctions.value.push(stopStopwatchCompleteWatch);

  // 8. 监听休息界面显示状态，调整窗口大小
  const stopBreakOverlayWatch = watch(
    () => breakOverlayVisible.value,
    async (show) => {
      if (show) {
        await handleDialogOpen(480); // Break Dialog 宽度 480px
      } else {
        await handleDialogClose();
      }
    }
  );
  cleanupFunctions.value.push(stopBreakOverlayWatch);
});

onBeforeUnmount(() => {
  console.log("[App] Cleaning up...");
  
  cleanupFunctions.value.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.error("[App] Cleanup failed:", error);
    }
  });
  
  // 清理 composable 内部的监听器
  traySync.cleanup();
  floatingWindow.cleanup();
});
</script>

<template>
  <main class="app-root">
    <header class="app-header" data-tauri-drag-region>
      <h1 class="app-title" data-tauri-drag-region>LPE Reminder</h1>
      <div class="header-actions">
        <button
          type="button"
          class="icon-btn settings-btn"
          @click="openSettings"
          aria-label="设置"
        >
          设置
        </button>
        <button
          type="button"
          class="icon-btn close-btn"
          @click="closeApp"
          aria-label="关闭"
        >
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
        :class="{ active: activeTab === 'statistics' }"
        @click="activeTab = 'statistics'"
      >
        统计与记录
      </button>
    </div>

    <div v-show="activeTab === 'timer'" class="tab-content">
      <TimerPanel
        v-if="settings.timerMode === 'countdown'"
        :mode="
          timer.mode.value === 'break' ? 'idle' : timer.mode.value
        "
        :remaining-ms="
          timer.mode.value === 'break'
            ? minutesSecondsToMs(
                settings.workDurationMinutes,
                settings.workDurationSeconds
              )
            : timer.remainingMs.value
        "
        :cycle-count="timer.cycleCount.value"
        :total-duration-ms="timer.totalDurationMs.value"
        :is-running="
          timer.mode.value === 'break' ? false : timer.isRunning.value
        "
        :category="currentCountdownCategory"
        @start="
          (category: string) => {
            currentCountdownCategory = category;
            timer.start();
          }
        "
        @pause="timer.pause()"
        @reset="handleReset"
        @skip-break="timer.skipBreak()"
      />

      <StopwatchPanel
        v-if="settings.timerMode === 'stopwatch'"
        :elapsed-ms="
          stopwatch.mode.value === 'break' ? 0 : stopwatch.elapsedMs.value
        "
        :is-running="
          stopwatch.mode.value === 'break' ? false : stopwatch.isRunning.value
        "
        @start="stopwatch.start()"
        @pause="stopwatch.pause()"
        @stop="stopwatch.stop()"
      />
    </div>

    <div v-show="activeTab === 'statistics'" class="tab-content">
      <StatisticsPanel />
    </div>

    <!-- 统一休息遮罩 -->
    <BreakOverlay
      :visible="breakOverlayVisible"
      :elapsed-ms="breakOverlayElapsed"
      :target-ms="breakOverlayTarget"
      :is-countdown="isCountdownMode"
      @end="handleBreakOverlayEnd"
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
html,
body {
  margin: 0;
  padding: 0;
  background: transparent !important;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
</style>

<style scoped>
.app-root {
  height: 100vh;
  padding: 12px;
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
  border-radius: 16px;
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
  font-size: 0;
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
  background: #fee2e2;
  color: #ef4444;
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
<!-- TODO: 正计时提醒 -->
<!-- TODO: 休息串口显示不完全 -->