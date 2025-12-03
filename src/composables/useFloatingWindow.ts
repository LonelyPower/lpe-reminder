import { watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "../utils/errorHandler";
import { saveSetting } from "../utils/database";
import type { AppSettings } from "./useSettingsDB";
import type { useTimer } from "./useTimer";
import type { useStopwatch } from "./useStopwatch";

/**
 * 悬浮窗管理
 * - 监听悬浮窗开关切换
 * - 同步计时器状态到悬浮窗
 * - 监听悬浮窗控制事件
 * - 同步显示设置和主题
 * - 保存/恢复悬浮窗位置
 */
export function useFloatingWindow(
  settings: AppSettings,
  timer: ReturnType<typeof useTimer>,
  stopwatch: ReturnType<typeof useStopwatch>
) {
  const unlistenFns: UnlistenFn[] = [];
  const stopWatchers: Array<() => void> = [];

  /**
   * 保存悬浮窗位置
   */
  async function saveFloatingWindowPosition(
    forceSaveToDb: boolean = false
  ): Promise<void> {
    if (!settings.enableFloatingWindow) return;

    try {
      const pos = await safeInvoke<[number, number]>(
        "get_floating_window_position"
      );
      if (pos) {
        settings.floatingWindowX = pos[0];
        settings.floatingWindowY = pos[1];

        // 如果需要强制保存到数据库（退出时）
        if (forceSaveToDb) {
          await saveSetting("floatingWindowX", pos[0].toString());
          await saveSetting("floatingWindowY", pos[1].toString());
        }
      }
    } catch (e) {
      console.error("Failed to save floating window position", e);
    }
  }

  /**
   * 同步计时器状态到悬浮窗
   */
  async function syncFloatingWindowState(): Promise<void> {
    if (!settings.enableFloatingWindow) return;

    await safeExecute(async () => {
      const appWindow = getCurrentWindow();
      const commonPayload = {
        theme: settings.theme,
      };

      if (settings.timerMode === "countdown") {
        const isBreakMode = timer.mode.value === "break";
        await appWindow.emit("timer-state-sync", {
          ...commonPayload,
          mode: timer.mode.value,
          remainingMs: timer.remainingMs.value,
          isRunning: timer.isRunning.value,
          timerMode: "countdown",
          // 休息模式专用字段
          isBreakMode: isBreakMode,
          breakElapsedMs: isBreakMode ? timer.breakElapsedMs.value : 0,
        });
      } else {
        const isBreakMode = stopwatch.mode.value === "break";
        await appWindow.emit("timer-state-sync", {
          ...commonPayload,
          mode: stopwatch.mode.value,
          elapsedMs: stopwatch.elapsedMs.value,
          isRunning: stopwatch.isRunning.value,
          timerMode: "stopwatch",
          // 休息模式专用字段
          isBreakMode: isBreakMode,
          breakElapsedMs: isBreakMode ? stopwatch.elapsedMs.value : 0,
        });
      }
    }, "Sync timer state to floating window");
  }

  /**
   * 设置悬浮窗同步监听器
   * 返回停止所有 watcher 的函数
   */
  function setupFloatingWindowSync(): () => void {
    const appWindow = getCurrentWindow();

    // 监听悬浮窗开关，控制显示/隐藏
    const stopFloatingWindowWatch = watch(
      () => settings.enableFloatingWindow,
      async (enabled) => {
        console.log("[FloatingWindow] Toggle:", enabled);
        if (enabled) {
          // 恢复位置
          if (
            settings.floatingWindowX !== undefined &&
            settings.floatingWindowY !== undefined
          ) {
            await safeInvoke("move_floating_window", {
              x: settings.floatingWindowX,
              y: settings.floatingWindowY,
            });
          }
          safeInvoke("toggle_floating_window", { show: true });
        } else {
          // 保存位置
          await saveFloatingWindowPosition();
          safeInvoke("toggle_floating_window", { show: false });
        }
      },
      { immediate: true }
    );
    stopWatchers.push(stopFloatingWindowWatch);

    // 监听悬浮窗大小变化，动态调整窗口尺寸
    const stopFloatingWindowSizeWatch = watch(
      () => [settings.floatingWindowWidth, settings.floatingWindowHeight],
      ([width, height]) => {
        if (settings.enableFloatingWindow) {
          console.log("[FloatingWindow] Resize to:", width, "x", height);
          safeInvoke("resize_floating_window", {
            width: width as number,
            height: height as number,
          });
          // 同步窗口尺寸到悬浮窗（用于自适应字体）
          safeExecute(async () => {
            await appWindow.emit("float-size-sync", {
              width: width as number,
              height: height as number,
            });
          }, "Sync window size to floating window");
        }
      },
      { immediate: true }
    );
    stopWatchers.push(stopFloatingWindowSizeWatch);

    // 监听悬浮窗显示设置变化
    const stopFloatingWindowDisplayWatch = watch(
      () => [
        settings.floatingWindowShowTimer,
        settings.floatingWindowShowState,
        settings.theme,
      ],
      ([showTimer, showState, theme]) => {
        if (settings.enableFloatingWindow) {
          console.log("[FloatingWindow] Display settings:", {
            showTimer,
            showState,
            theme,
          });
          safeExecute(async () => {
            await appWindow.emit("float-display-settings-sync", {
              showTimer: showTimer as boolean,
              showState: showState as boolean,
              theme: theme as string,
            });
          }, "Sync display settings to floating window");
        }
      },
      { immediate: true }
    );
    stopWatchers.push(stopFloatingWindowDisplayWatch);

    // 监听计时器状态变化，同步到悬浮窗
    const stopTimerStateWatch = watch(
      () => [
        settings.timerMode,
        timer.mode.value,
        timer.remainingMs.value,
        timer.isRunning.value,
        timer.breakElapsedMs.value,
        stopwatch.mode.value,
        stopwatch.elapsedMs.value,
        stopwatch.isRunning.value,
      ],
      () => {
        syncFloatingWindowState();
      }
    );
    stopWatchers.push(stopTimerStateWatch);

    // 返回清理函数
    return () => {
      stopWatchers.forEach((stop) => {
        try {
          stop();
        } catch (error) {
          console.error("[FloatingWindow] Failed to stop watcher:", error);
        }
      });
      stopWatchers.length = 0;
    };
  }

  /**
   * 设置悬浮窗事件监听器
   */
  async function setupFloatingWindowListeners(): Promise<void> {
    const appWindow = getCurrentWindow();

    unlistenFns.push(
      await listen("float-start", () => {
        console.log("[Float] Start event received");
        if (settings.timerMode === "countdown") {
          timer.start();
        } else {
          stopwatch.start();
        }
      })
    );

    unlistenFns.push(
      await listen("float-pause", () => {
        console.log("[Float] Pause event received");
        if (settings.timerMode === "countdown") {
          timer.pause();
        } else {
          stopwatch.pause();
        }
      })
    );

    unlistenFns.push(
      await listen("float-stop", () => {
        console.log("[Float] Stop event received");
        if (settings.timerMode === "stopwatch") {
          stopwatch.stop();
        }
      })
    );

    // 监听悬浮窗请求显示主窗口（休息模式下点击）
    unlistenFns.push(
      await listen("float-show-main", async () => {
        console.log("[Float] Show main window requested");
        await safeExecute(async () => {
          await appWindow.show();
          await appWindow.setFocus();
        }, "Show main window from floating window");
      })
    );

    // 初始同步一次状态
    await syncFloatingWindowState();
  }

  /**
   * 清理所有悬浮窗监听器
   */
  function cleanup(): void {
    unlistenFns.forEach((unlisten) => {
      try {
        unlisten();
      } catch (error) {
        console.error("[FloatingWindow] Failed to unlisten:", error);
      }
    });
    unlistenFns.length = 0;
  }

  return {
    saveFloatingWindowPosition,
    setupFloatingWindowSync,
    setupFloatingWindowListeners,
    cleanup,
  };
}
