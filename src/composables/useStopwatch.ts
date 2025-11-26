import { ref, onBeforeUnmount } from "vue";

export interface StopwatchCallbacks {
  onBreakEnd?: () => void | Promise<void>;
}

/**
 * 正计时器（Stopwatch）- 从0开始计时
 * 支持工作后休息模式
 */
export function useStopwatch(callbacks?: StopwatchCallbacks) {
  const elapsedMs = ref(0);
  const isRunning = ref(false);
  const mode = ref<"work" | "break">("work"); // work: 工作中, break: 休息中
  const breakTargetMs = ref(0); // 休息目标时长

  let intervalId: number | null = null;
  let lastTick = 0; // 上一次 tick 的时间戳（ms）

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick(now: number) {
    if (!isRunning.value) return;
    const delta = now - lastTick;
    lastTick = now;
    elapsedMs.value += delta;
  }

  function ensureIntervalRunning() {
    if (intervalId != null) return;
    lastTick = Date.now();
    intervalId = window.setInterval(() => tick(Date.now()), 200);
  }

  /**
   * 开始/继续计时
   */
  function start() {
    isRunning.value = true;
    ensureIntervalRunning();
  }

  /**
   * 暂停计时
   */
  function pause() {
    isRunning.value = false;
    clearTimer();
  }

  /**
   * 停止并重置计时器（结束工作）
   */
  function stop() {
    isRunning.value = false;
    clearTimer();
    elapsedMs.value = 0;
    mode.value = "work";
  }

  /**
   * 开始休息倒计时
   * @param targetMs 休息目标时长（毫秒）
   */
  function startBreak(targetMs: number) {
    mode.value = "break";
    breakTargetMs.value = targetMs;
    elapsedMs.value = 0;
    isRunning.value = true;
    ensureIntervalRunning();
    
    // 检查是否超过目标时长
    const checkBreakEnd = () => {
      if (mode.value === "break" && elapsedMs.value >= breakTargetMs.value) {
        // 触发回调
        if (callbacks?.onBreakEnd) {
          callbacks.onBreakEnd();
        }
        // 注意：不自动停止，允许超时继续计时
      }
    };
    
    // 监听进度
    const checkInterval = window.setInterval(() => {
      if (mode.value !== "break" || !isRunning.value) {
        clearInterval(checkInterval);
        return;
      }
      checkBreakEnd();
    }, 500);
  }

  /**
   * 结束休息
   */
  function endBreak() {
    isRunning.value = false;
    clearTimer();
    elapsedMs.value = 0;
    mode.value = "work";
  }

  /**
   * 跳过休息
   */
  function skipBreak() {
    endBreak();
  }

  onBeforeUnmount(() => {
    clearTimer();
    isRunning.value = false;
  });

  return {
    elapsedMs,
    isRunning,
    mode,
    breakTargetMs,
    start,
    pause,
    stop,
    startBreak,
    endBreak,
    skipBreak,
  };
}
