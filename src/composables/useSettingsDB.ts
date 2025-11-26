import { reactive, watch } from "vue";
import { initDatabase, getCurrentUser, getDatabase } from "../utils/database";

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
};

const settings = reactive<AppSettings>({ ...defaultSettings });
let userId: number | null = null;
let initialized = false;

/**
 * 从数据库加载设置
 */
async function loadSettings() {
  try {
    await initDatabase();
    userId = await getCurrentUser();
    const db = getDatabase();
    
    const rows = await db.select<Array<{ key: string; value: string }>>(
      "SELECT key, value FROM settings WHERE user_id = $1",
      [userId]
    );
    
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
  if (!userId) return;
  
  try {
    const db = getDatabase();
    const now = Date.now();
    
    for (const [key, value] of Object.entries(settings)) {
      await db.execute(
        `INSERT OR REPLACE INTO settings (user_id, key, value, updated_at) 
         VALUES ($1, $2, $3, $4)`,
        [userId, key, JSON.stringify(value), now]
      );
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
