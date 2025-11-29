import { reactive, watch } from "vue";
import { initDatabase, getSettings, saveSetting } from "../utils/database";

export interface AppSettings {
  timerMode: "countdown" | "stopwatch";
  workDurationMinutes: number;
  workDurationSeconds: number;
  breakDurationMinutes: number;
  breakDurationSeconds: number;
  stopwatchBreakMinutes: number;
  stopwatchBreakSeconds: number;
  enableworkSound: boolean;
  enablerestSound: boolean;
  enableNotification: boolean;
  closeBehavior: "ask" | "minimize" | "quit";
  enableFloatingWindow: boolean;
  floatingWindowWidth: number;
  floatingWindowHeight: number;
  floatingWindowShowTimer: boolean;
  floatingWindowShowState: boolean;
  floatingWindowX?: number;
  floatingWindowY?: number;
  windowWidth?: number;
  windowHeight?: number;
  theme: "light" | "dark" | "system";
}

export const defaultSettings: AppSettings = {
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
  floatingWindowX: undefined,
  floatingWindowY: undefined,
  windowWidth: 450,
  windowHeight: 550,
  theme: "dark",
};

const settings = reactive<AppSettings>({ ...defaultSettings });
let initialized = false;

/**
 * 从数据库加载设置
 */
async function loadSettings() {
  try {
    await initDatabase();
    const rows = await getSettings();
    
    // 应用数据库中的设置
    for (const row of rows) {
      try {
        const value = JSON.parse(row.value);
        if (row.key in settings) {
          (settings as any)[row.key] = value;
        }
      } catch (e) {
        console.error(`Failed to parse setting ${row.key}:`, e);
      }
    }
    
    console.log("✓ Settings loaded from database");
  } catch (error) {
    console.error("Failed to load settings from database:", error);
    // 如果失败，使用默认设置
  }
}

/**
 * 保存设置到数据库
 */
async function saveSettings() {
  try {
    for (const [key, value] of Object.entries(settings)) {
      await saveSetting(key, JSON.stringify(value));
    }
    
    console.log("✓ Settings saved to database");
  } catch (error) {
    console.error("Failed to save settings to database:", error);
  }
}

/**
 * 监听设置变化并自动保存
 */
function setupAutoSave() {
  watch(
    settings,
    () => {
      if (initialized) {
        saveSettings();
      }
    },
    { deep: true }
  );
}

export function useSettings() {
  // 初始化（仅执行一次）
  if (!initialized) {
    initialized = true;
    loadSettings().then(() => {
      setupAutoSave();
    });
  }
  
  function resetToDefault() {
    Object.assign(settings, defaultSettings);
  }

  return {
    settings,
    defaultSettings,
    resetToDefault,
  };
}
