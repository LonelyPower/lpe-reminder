import { ref, computed, onBeforeUnmount } from "vue";

export type TimerMode = "idle" | "work" | "break";

export interface UseTimerOptions {
  workDurationMs?: number;
  breakDurationMs?: number;
  onWorkEnd?: () => void;
  onBreakEnd?: (silent?: boolean) => void;
}

/**
 * 可复用计时器状态机（与 UI / 平台无关）
 * - 只暴露响应式状态和控制方法
 * - 内部用单一 setInterval + 时间戳避免计时漂移
 */
export function useTimer(options: UseTimerOptions = {}) {
  // 使用 ref 来存储时长，以便后续更新
  const workDurationMs = ref(options.workDurationMs ?? 25 * 1 * 1000);
  const breakDurationMs = ref(options.breakDurationMs ?? 5 * 1 * 1000);

  const mode = ref<TimerMode>("idle");
  // 初始和重置时都显示完整一个工作时长，方便用户一眼看到 25:00
  const remainingMs = ref(workDurationMs.value);
  // 记录当前周期的总时长，用于计算进度条，避免配置修改时进度条跳变
  const currentTotalDurationMs = ref(workDurationMs.value);
  const cycleCount = ref(0);
  const isRunning = ref(false);
  const breakStartTime = ref(0); // 休息开始时间戳
  const breakElapsedMs = ref(0); // 休息已过时长（用于超时计时）

  let intervalId: number | null = null;
  let lastTick = 0; // 上一次 tick 的时间戳（ms）
  let breakEndTriggered = false; // 标记休息结束回调是否已触发

  function updateDurations(newWorkMs: number, newBreakMs: number) {
    workDurationMs.value = newWorkMs;
    breakDurationMs.value = newBreakMs;
    // 如果处于 idle 状态，立即更新显示时间
    if (mode.value === "idle") {
      remainingMs.value = newWorkMs;
      currentTotalDurationMs.value = newWorkMs;
    }
  }

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function setMode(next: TimerMode) {
    mode.value = next;
    if (next === "work") {
      remainingMs.value = workDurationMs.value;
      currentTotalDurationMs.value = workDurationMs.value;
    } else if (next === "break") {
      remainingMs.value = breakDurationMs.value;
      currentTotalDurationMs.value = breakDurationMs.value;
      breakStartTime.value = Date.now();
      breakElapsedMs.value = 0;
      breakEndTriggered = false; // 重置标志
    } else {
      remainingMs.value = 0;
      currentTotalDurationMs.value = 0;
    }
  }

  function tick(now: number) {
    if (!isRunning.value) return;
    const delta = now - lastTick;
    lastTick = now;
    
    if (mode.value === "work") {
      // 工作模式：正常倒计时
      remainingMs.value = Math.max(0, remainingMs.value - delta);
      if (remainingMs.value <= 0) {
        // 工作结束 -> 进入休息
        cycleCount.value += 1;
        breakStartTime.value = Date.now();
        breakElapsedMs.value = 0;
        setMode("break");
        options.onWorkEnd?.();
      }
    } else if (mode.value === "break") {
      // 休息模式：允许超时继续计时
      remainingMs.value = Math.max(0, remainingMs.value - delta);
      breakElapsedMs.value += delta;
      
      // 仅在首次到达目标时间时触发回调（播放音乐等）
      if (remainingMs.value <= 0 && !breakEndTriggered) {
        breakEndTriggered = true;
        options.onBreakEnd?.();
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
    remainingMs.value = workDurationMs.value;
    currentTotalDurationMs.value = workDurationMs.value;
  }

  /**
   * 跳过当前休息：仅在 break 模式下生效
   * - 立即切到工作
   * - 保持 isRunning 状态不变（如果原本在计时，则继续走）
   * @param silent 是否静音（不播放提示音）
   */
  function skipBreak(silent: boolean = false) {
    if (mode.value !== "break") return;
    setMode("work");
    options.onBreakEnd?.(silent);
    if (isRunning.value) {
      ensureIntervalRunning();
    }
  }

  const totalDurationMs = computed(() => currentTotalDurationMs.value);

  onBeforeUnmount(() => {
    // 清理定时器
    clearTimer();
    // 重置所有状态，防止内存泄漏
    isRunning.value = false;
    mode.value = "idle";
  });

  return {
    mode,
    remainingMs,
    cycleCount,
    isRunning,
    totalDurationMs,
    breakStartTime,
    breakElapsedMs,
    start,
    pause,
    reset,
    skipBreak,
    updateDurations,
  };
}
