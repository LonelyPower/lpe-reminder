import { ref, computed } from "vue";

export type TimerMode = "idle" | "work" | "break";

/**
 * 阶段0：仅提供最小可用接口，内部逻辑后续在阶段1完整实现。
 */
export function useTimer() {
  const mode = ref<TimerMode>("idle");
  const remainingMs = ref(0);
  const cycleCount = ref(0);
  const isRunning = ref(false);

  function start() {
    mode.value = "work";
    isRunning.value = true;
  }

  function pause() {
    isRunning.value = false;
  }

  function reset() {
    mode.value = "idle";
    isRunning.value = false;
    remainingMs.value = 0;
  }

  function skipBreak() {
    // 阶段0：占位实现，后续补完状态机
    mode.value = "work";
    isRunning.value = true;
  }

  const displayRemainingMs = computed(() => remainingMs.value);

  return {
    mode,
    remainingMs: displayRemainingMs,
    cycleCount,
    isRunning,
    start,
    pause,
    reset,
    skipBreak,
  };
}
