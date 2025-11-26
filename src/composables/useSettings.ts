import { reactive, watch } from "vue";

export interface AppSettings {
  timerMode: "countdown" | "stopwatch";
  workDurationMinutes: number;
  workDurationSeconds: number;
  breakDurationMinutes: number;
  breakDurationSeconds: number;
  stopwatchBreakMinutes: number; // 正计时休息时长（分钟）
  stopwatchBreakSeconds: number; // 正计时休息时长（秒）
  enableworkSound: boolean;
  enablerestSound: boolean;
  enableNotification: boolean;
  closeBehavior: "ask" | "minimize" | "quit";
  enableFloatingWindow: boolean;
  floatingWindowWidth: number;
  floatingWindowHeight: number;
  floatingWindowShowTimer: boolean;
  floatingWindowShowState: boolean;
}

const STORAGE_KEY = "lpe-reminder-settings";

const defaultSettings: AppSettings = {
  timerMode: "countdown",
  workDurationMinutes: 25,
  workDurationSeconds: 0,
  breakDurationMinutes: 5,
  breakDurationSeconds: 0,
  stopwatchBreakMinutes: 5,
  stopwatchBreakSeconds: 0,
  enableworkSound: true,
  enablerestSound: true,
  enableNotification: true,
  closeBehavior: "ask",
  enableFloatingWindow: false,
  floatingWindowWidth: 150,
  floatingWindowHeight: 50,
  floatingWindowShowTimer: true,
  floatingWindowShowState: true,
};

// 1. 初始化：尝试从 localStorage 读取，失败则使用默认值
const saved = localStorage.getItem(STORAGE_KEY);
let initial: AppSettings = defaultSettings;

if (saved) {
  try {
    initial = { ...defaultSettings, ...JSON.parse(saved) };
  } catch (e) {
    console.error("Failed to parse settings:", e);
  }
}

const settings = reactive<AppSettings>(initial);

// 2. 监听变更：自动保存到 localStorage
watch(
  settings,
  (newSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  },
  { deep: true }
);

export function useSettings() {
  function resetToDefault() {
    Object.assign(settings, defaultSettings);
  }

  return {
    settings,
    defaultSettings,
    resetToDefault,
  };
}
