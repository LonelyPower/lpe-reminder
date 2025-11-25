import { ref, computed, onBeforeUnmount } from "vue";

export type TimerMode = "idle" | "work" | "break";

export interface UseTimerOptions {
  workDurationMs?: number;
  breakDurationMs?: number;
}

/**
 * 可复用计时器状态机（与 UI / 平台无关）
 * - 只暴露响应式状态和控制方法
 * - 内部用单一 setInterval + 时间戳避免计时漂移
 */
export function useTimer(options: UseTimerOptions = {}) {
  const workDurationMs = options.workDurationMs ?? 25 * 60 * 1000;
  const breakDurationMs = options.breakDurationMs ?? 5 * 60 * 1000;

  const mode = ref<TimerMode>("idle");
  // 初始和重置时都显示完整一个工作时长，方便用户一眼看到 25:00
  const remainingMs = ref(workDurationMs);
  const cycleCount = ref(0);
  const isRunning = ref(false);

  let intervalId: number | null = null;
  let lastTick = 0; // 上一次 tick 的时间戳（ms）

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function setMode(next: TimerMode) {
    mode.value = next;
    if (next === "work") {
      remainingMs.value = workDurationMs;
    } else if (next === "break") {
      remainingMs.value = breakDurationMs;
    } else {
      remainingMs.value = 0;
    }
  }

  function tick(now: number) {
    if (!isRunning.value) return;
    const delta = now - lastTick;
    lastTick = now;
    remainingMs.value = Math.max(0, remainingMs.value - delta);

    if (remainingMs.value <= 0) {
      // 当前阶段结束，自动切换
      if (mode.value === "work") {
        // 工作结束 -> 进入休息
        cycleCount.value += 1;
        setMode("break");
      } else if (mode.value === "break") {
        // 休息结束 -> 回到工作
        setMode("work");
      } else {
        // idle 理论上不会走到这里
        isRunning.value = false;
        clearTimer();
        return;
      }
    }
  }

  function ensureIntervalRunning() {
    if (intervalId != null) return;
    lastTick = Date.now();
    intervalId = window.setInterval(() => tick(Date.now()), 200);
  }

  /**
   * 从 idle 或 break 进入工作模式
   */
  function start() {
    if (mode.value === "idle" || mode.value === "break") {
      setMode("work");
    }
    isRunning.value = true;
    ensureIntervalRunning();
  }

  function pause() {
    isRunning.value = false;
    clearTimer();
  }

  function reset() {
    isRunning.value = false;
    clearTimer();
    mode.value = "idle";
    remainingMs.value = workDurationMs;
  }

  /**
   * 跳过当前休息：仅在 break 模式下生效
   * - 立即切到工作
   * - 保持 isRunning 状态不变（如果原本在计时，则继续走）
   */
  function skipBreak() {
    if (mode.value !== "break") return;
    setMode("work");
    if (isRunning.value) {
      ensureIntervalRunning();
    }
  }

  const totalDurationMs = computed(() => {
    if (mode.value === "idle") return workDurationMs;
    if (mode.value === "work") return workDurationMs;
    if (mode.value === "break") return breakDurationMs;
    return 0;
  });

  onBeforeUnmount(() => {
    clearTimer();
  });

  return {
    mode,
    remainingMs,
    cycleCount,
    isRunning,
    totalDurationMs,
    start,
    pause,
    reset,
    skipBreak,
  };
}
