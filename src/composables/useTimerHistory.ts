import { reactive, watch } from "vue";

export interface TimerRecord {
  id: string;
  type: "countdown" | "stopwatch";
  startTime: number; // 时间戳
  endTime: number; // 时间戳
  duration: number; // 持续时长（毫秒）
  mode?: "work" | "break"; // 倒计时模式专用
  name?: string; // 记录名称（可选）
}

const STORAGE_KEY = "lpe-reminder-history";
const MAX_RECORDS = 100; // 最多保存100条记录

// 从 localStorage 加载历史记录
function loadRecords(): TimerRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const records = JSON.parse(saved);
      // 按时间倒序排序（最新的在前）
      return records.sort((a: TimerRecord, b: TimerRecord) => b.endTime - a.endTime);
    }
  } catch (e) {
    console.error("Failed to load timer records:", e);
  }
  return [];
}

// 保存历史记录到 localStorage
function saveRecords(records: TimerRecord[]) {
  try {
    // 只保留最新的 MAX_RECORDS 条
    const limited = records.slice(0, MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (e) {
    console.error("Failed to save timer records:", e);
  }
}

const records = reactive<TimerRecord[]>(loadRecords());

// 监听变化，自动保存
watch(
  () => [...records],
  (newRecords) => {
    saveRecords(newRecords);
  },
  { deep: true }
);

export function useTimerHistory() {
  /**
   * 添加一条新记录
   */
  function addRecord(record: Omit<TimerRecord, "id">) {
    const newRecord: TimerRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    records.unshift(newRecord); // 添加到开头
    
    // 如果超过最大数量，删除最旧的
    if (records.length > MAX_RECORDS) {
      records.splice(MAX_RECORDS);
    }
  }

  /**
   * 删除指定记录
   */
  function deleteRecord(id: string) {
    const index = records.findIndex((r) => r.id === id);
    if (index !== -1) {
      records.splice(index, 1);
    }
  }

  /**
   * 清空所有记录
   */
  function clearRecords() {
    records.splice(0, records.length);
  }

  /**
   * 获取今天的记录
   */
  function getTodayRecords(): TimerRecord[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    return records.filter((r) => r.endTime >= todayStart);
  }

  /**
   * 获取本周的记录
   */
  function getWeekRecords(): TimerRecord[] {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.getTime();
    
    return records.filter((r) => r.endTime >= weekStart);
  }

  /**
   * 计算总时长（毫秒）
   */
  function getTotalDuration(recordList: TimerRecord[]): number {
    return recordList.reduce((sum, r) => sum + r.duration, 0);
  }

  return {
    records,
    addRecord,
    deleteRecord,
    clearRecords,
    getTodayRecords,
    getWeekRecords,
    getTotalDuration,
  };
}
