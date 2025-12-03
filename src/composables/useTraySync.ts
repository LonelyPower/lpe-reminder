import { computed, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { safeInvoke, safeExecute } from "../utils/errorHandler";
import type { AppSettings } from "./useSettingsDB";
import type { useTimer } from "./useTimer";
import type { useStopwatch } from "./useStopwatch";

/**
 * 托盘菜单同步管理
 * - 监听托盘菜单事件（start/pause/reset/settings/quit）
 * - 同步托盘图标状态（idle/working/paused/break）
 */
export function useTraySync(
  settings: AppSettings,
  timer: ReturnType<typeof useTimer>,
  stopwatch: ReturnType<typeof useStopwatch>,
  handlers: {
    onReset: () => void;
    onSettings: () => void;
    onQuit: () => Promise<void>;
  }
) {
  const unlistenFns: UnlistenFn[] = [];

  /**
   * 设置托盘菜单事件监听器
   */
  async function setupTrayListeners(): Promise<void> {
    const appWindow = getCurrentWindow();

    unlistenFns.push(
      await listen("tray-start", () => {
        console.log("[Tray] Start event received");
        if (settings.timerMode === "countdown") {
          timer.start();
        } else {
          stopwatch.start();
        }
      })
    );

    unlistenFns.push(
      await listen("tray-pause", () => {
        console.log("[Tray] Pause event received");
        if (settings.timerMode === "countdown") {
          timer.pause();
        } else {
          stopwatch.pause();
        }
      })
    );

    unlistenFns.push(
      await listen("tray-reset", () => {
        console.log("[Tray] Reset/Stop event received");
        if (settings.timerMode === "countdown") {
          handlers.onReset();
        } else {
          stopwatch.stop();
        }
      })
    );

    unlistenFns.push(
      await listen("tray-settings", async () => {
        console.log("[Tray] Settings event received");
        await safeExecute(async () => {
          await appWindow.show();
          await appWindow.setFocus();
          handlers.onSettings();
        }, "Show settings from tray");
      })
    );

    unlistenFns.push(
      await listen("tray-quit", async () => {
        console.log("[Tray] Quit event received");
        await handlers.onQuit();
        await safeInvoke("app_exit");
      })
    );
  }

  /**
   * 启动托盘图标状态同步
   * 返回停止函数
   */
  function startTrayIconSync(): () => void {
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

    const stopWatch = watch(
      trayIconState,
      (state) => {
        console.log("[Tray] Updating icon state to:", state);
        safeInvoke("set_tray_icon", { state });
      },
      { immediate: true } // 立即执行一次，确保初始状态正确
    );

    return stopWatch;
  }

  /**
   * 清理所有托盘监听器
   */
  function cleanup(): void {
    unlistenFns.forEach((unlisten) => {
      try {
        unlisten();
      } catch (error) {
        console.error("[TraySync] Failed to unlisten:", error);
      }
    });
    unlistenFns.length = 0;
  }

  return {
    setupTrayListeners,
    startTrayIconSync,
    cleanup,
  };
}
