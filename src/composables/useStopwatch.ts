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
  let breakEndTriggered = false; // 标记休息结束回调是否已触发

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

    // 检查休息是否结束
    if (mode.value === "break" && elapsedMs.value >= breakTargetMs.value && !breakEndTriggered) {
      breakEndTriggered = true; // 标记已触发
      // 触发回调
      if (callbacks?.onBreakEnd) {
        callbacks.onBreakEnd();
      }
    }
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
    breakEndTriggered = false; // 重置标志
    ensureIntervalRunning();
  }

  /**
   * 结束休息
   */
  function endBreak() {
    isRunning.value = false;
    clearTimer();
    elapsedMs.value = 0;
    mode.value = "work";
    breakEndTriggered = false; // 重置标志
  }

  /**
   * 跳过休息
   */
  function skipBreak() {
    endBreak();
  }

  function updateCallbacks(newCallbacks: Partial<StopwatchCallbacks>) {
    if (newCallbacks.onBreakEnd) {
      callbacks = { ...callbacks, ...newCallbacks };
    }
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
    updateCallbacks,
  };
}
