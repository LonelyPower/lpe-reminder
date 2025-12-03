import { ref, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { safeExecute } from "../utils/errorHandler";
import { playAudio } from "../utils/audioPlayer";
import { minutesSecondsToMs } from "../utils/timeUtils";
import type { AppSettings } from "./useSettingsDB";
import type { useTimer } from "./useTimer";
import type { useStopwatch } from "./useStopwatch";
import type { useTimerHistory } from "./useTimerHistoryDB";

/**
 * 计时器业务逻辑处理
 * - 处理倒计时工作/休息结束逻辑
 * - 处理正计时完成对话框逻辑
 * - 集成通知、音频、记录保存
 */
export function useTimerHandlers(
  settings: AppSettings,
  timer: ReturnType<typeof useTimer>,
  stopwatch: ReturnType<typeof useStopwatch>,
  addRecord: ReturnType<typeof useTimerHistory>["addRecord"]
) {
  const currentCountdownCategory = ref<string>("work");
  const showStopwatchComplete = ref(false);
  const stopwatchWorkDuration = ref(0);

  /**
   * 设置正计时提醒回调
   */
  function setupStopwatchReminderCallback(): void {
    stopwatch.updateCallbacks({
      onReminderReached: async () => {
        // 1. 发送系统通知
        if (settings.enableNotification) {
          await safeExecute(async () => {
            let permissionGranted = await isPermissionGranted();
            if (!permissionGranted) {
              const permission = await requestPermission();
              permissionGranted = permission === "granted";
            }

            if (permissionGranted) {
              sendNotification({
                title: "提醒时间到！",
                body: "已工作一段时间，别忘了休息哦！",
                sound: "default",
              });
            }
          }, "Send stopwatch reminder notification");
        }

        // 2. 播放提示音
        if (settings.enableStopwatchReminderSound) {
          await safeExecute(async () => {
            await playAudio("/notification-piano.mp3", 0.5);
          }, "Play stopwatch reminder sound");
        }
      },
    });
  }

  /**
   * 设置倒计时器的回调函数
   */
  function setupTimerCallbacks(): void {
    // 工作结束回调
    timer.updateCallbacks({
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
          category: currentCountdownCategory.value || "work",
        });
        console.log("[Countdown] Work record saved:", workDuration, "ms");

        // 1. 显示、置顶并获取焦点
        const win = getCurrentWindow();
        await safeExecute(async () => {
          await win.show();
          await win.setAlwaysOnTop(true);
          await win.setFocus();
        }, "Show and focus window on work end");

        // 2. 发送系统通知
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

        // 3. 播放提示音
        if (settings.enableworkSound) {
          await safeExecute(async () => {
            await playAudio("/notification-piano.mp3", 0.5);
          }, "Play work end sound");
        }
      },
      onBreakEnd: async (silent?: boolean) => {
        // 0. 保存休息记录（使用实际休息时长）
        const endTime = Date.now();
        const actualBreakDuration = timer.breakElapsedMs.value;
        addRecord({
          type: "countdown",
          mode: "break",
          startTime: endTime - actualBreakDuration,
          endTime: endTime,
          duration: actualBreakDuration,
          category: currentCountdownCategory.value || "work",
        });
        console.log(
          "[Countdown] Break record auto-saved:",
          actualBreakDuration,
          "ms"
        );

        // 1. 播放提示音
        if (!silent && settings.enablerestSound) {
          await safeExecute(async () => {
            await playAudio("/notification-chime.mp3", 0.5);
          }, "Play break end sound");
        }
      },
    });

    // 正计时休息结束回调
    stopwatch.updateCallbacks({
      onBreakEnd: async () => {
        // 休息结束提示
        if (settings.enablerestSound) {
          await safeExecute(async () => {
            await playAudio("/notification-chime.mp3", 0.5);
          }, "Play stopwatch break end sound");
        }
      },
    });
  }

  /**
   * 监听正计时停止，显示完成对话框
   */
  function setupStopwatchWatcher(): () => void {
    return watch(
      () => [stopwatch.elapsedMs.value, stopwatch.mode.value] as const,
      ([newElapsed, newMode], [oldElapsed, oldMode]) => {
        // 当 elapsedMs 从非零变为零，且在变化前是工作模式，且在变化后仍是工作模式（即调用了 stop()），显示对话框
        if (
          (oldElapsed as number) > 0 &&
          (newElapsed as number) === 0 &&
          oldMode === "work" &&
          newMode === "work"
        ) {
          stopwatchWorkDuration.value = oldElapsed as number;
          showStopwatchComplete.value = true;
          console.log("[Stopwatch] Work completed:", oldElapsed, "ms");
        }
      }
    );
  }

  /**
   * 处理倒计时休息结束（用户手动点击按钮）
   */
  async function handleCountdownBreakEnd(): Promise<void> {
    // 取消窗口置顶
    const win = getCurrentWindow();
    await safeExecute(async () => {
      await win.setAlwaysOnTop(false);
    }, "Cancel window always on top");

    // 结束休息（休息记录已在 onBreakEnd 中自动保存）
    timer.skipBreak(true);
    console.log("[Countdown] Break ended manually by user");
  }

  /**
   * 处理正计时休息结束（用户手动点击按钮）
   */
  async function handleStopwatchBreakEnd(): Promise<void> {
    const endTime = Date.now();
    const breakDuration = stopwatch.elapsedMs.value;

    // 取消窗口置顶
    const win = getCurrentWindow();
    await safeExecute(async () => {
      await win.setAlwaysOnTop(false);
    }, "Cancel window always on top");

    // 保存休息记录
    addRecord({
      type: "stopwatch",
      mode: "break",
      startTime: endTime - breakDuration,
      endTime: endTime,
      duration: breakDuration,
      category: "break",
    });
    console.log("[Stopwatch] Break record saved:", breakDuration, "ms");

    stopwatch.endBreak();
  }

  /**
   * 处理正计时完成对话框
   */
  function handleStopwatchComplete(data: {
    name: string;
    takeBreak: boolean;
    category: string;
  }): void {
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
      category: data.category,
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

  return {
    currentCountdownCategory,
    showStopwatchComplete,
    stopwatchWorkDuration,
    setupTimerCallbacks,
    setupStopwatchWatcher,
    setupStopwatchReminderCallback,
    handleCountdownBreakEnd,
    handleStopwatchBreakEnd,
    handleStopwatchComplete,
  };
}
