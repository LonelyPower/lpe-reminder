import { ref, onBeforeUnmount } from "vue";

/**
 * 正计时器（Stopwatch）- 从0开始计时
 * 简化版本：只有 start/pause/stop，无工作/休息切换
 */
export function useStopwatch() {
  const elapsedMs = ref(0);
  const isRunning = ref(false);

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
   * 停止并重置计时器
   */
  function stop() {
    isRunning.value = false;
    clearTimer();
    elapsedMs.value = 0;
  }

  onBeforeUnmount(() => {
    clearTimer();
    isRunning.value = false;
  });

  return {
    elapsedMs,
    isRunning,
    start,
    pause,
    stop,
  };
}
