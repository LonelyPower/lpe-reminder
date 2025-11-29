import { reactive } from "vue";
import { initDatabase, getSettings, saveSettingsBatch } from "../utils/database";

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
  windowX?: number;
  windowY?: number;
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
  enableFloatingWindow: true,
  floatingWindowWidth: 150,
  floatingWindowHeight: 50,
  floatingWindowShowTimer: true,
  floatingWindowShowState: true,
  floatingWindowX: undefined,
  floatingWindowY: undefined,
  windowWidth: 450,
  windowHeight: 550,
  windowX: undefined,
  windowY: undefined,
  theme: "dark",
};

const settings = reactive<AppSettings>({ ...defaultSettings });
let initialized = false;
let initPromise: Promise<void> | null = null;

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
 * 手动保存设置到数据库（批量操作）
 * 由用户主动调用，而非自动保存
 */
async function saveSettingsToDB(): Promise<void> {
  try {
    // 将设置转换为 [key, value] 数组格式
    const settingsPairs = Object.entries(settings).map(([key, value]) => [
      key,
      JSON.stringify(value)
    ]) as Array<[string, string]>;
    
    // 批量保存到数据库
    await saveSettingsBatch(settingsPairs);
    
    console.log("✓ Settings saved to database (batch)");
  } catch (error) {
    console.error("Failed to save settings to database:", error);
    throw error; // 抛出错误让调用方处理
  }
}

export function useSettings() {
  /**
   * 初始化设置（可 await）
   * 确保数据库设置加载完成
   */
  async function init(): Promise<void> {
    // 如果已经初始化过，返回缓存的 Promise
    if (initPromise) {
      return initPromise;
    }
    
    // 如果正在初始化，创建并缓存 Promise
    if (!initialized) {
      initialized = true;
      initPromise = loadSettings();
    }
    
    return initPromise || Promise.resolve();
  }
  
  /**
   * 手动保存当前设置到数据库
   * 在用户点击保存按钮时调用
   */
  async function save(): Promise<void> {
    if (!initialized) {
      console.warn("Settings not initialized, skipping save");
      return;
    }
    await saveSettingsToDB();
  }
  
  function resetToDefault() {
    Object.assign(settings, defaultSettings);
  }

  return {
    settings,
    init,
    save,
    defaultSettings,
    resetToDefault,
  };
}
