import { ref } from "vue";
import { 
  initDatabase, 
  getTimerRecords as getRecordsDB,
  addTimerRecord as addRecordDB,
  deleteTimerRecord as deleteRecordDB,
  clearTimerRecords as clearRecordsDB
} from "../utils/database";

export interface TimerRecord {
  id: string;
  type: "countdown" | "stopwatch";
  startTime: number;
  endTime: number;
  duration: number;
  mode?: "work" | "break";
  name?: string;
  category?: string;
}

const records = ref<TimerRecord[]>([]);
let initialized = false;

/**
 * 从数据库加载历史记录
 */
async function loadRecords(): Promise<void> {
  try {
    await initDatabase();
    const rows = await getRecordsDB(100);
    
    records.value = rows.map(row => ({
      id: row.id,
      type: row.record_type as "countdown" | "stopwatch",
      mode: row.mode as "work" | "break" | undefined,
      name: row.name || undefined,
      category: row.category || undefined,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
    }));
    
    console.log(`✓ Loaded ${records.value.length} records from database`);
  } catch (error) {
    console.error("Failed to load records from database:", error);
    records.value = [];
  }
}

export function useTimerHistory() {
  // 初始化（仅执行一次）
  if (!initialized) {
    initialized = true;
    loadRecords(); // 异步加载，不阻塞初始化
    console.log("[useTimerHistory] Initializing and loading records...");
  }
  
  /**
   * 添加一条新记录
   */
  function addRecord(record: Omit<TimerRecord, "id">) {
    const newRecord: TimerRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    console.log("[useTimerHistory] Adding record:", newRecord);
    
    // 添加到内存
    records.value.unshift(newRecord);
    
    // 保持最多 100 条
    if (records.value.length > 100) {
      records.value = records.value.slice(0, 100);
    }
    
    // 保存到数据库
    addRecordDB({
      id: newRecord.id,
      record_type: newRecord.type,
      mode: newRecord.mode || null,
      name: newRecord.name || null,
      category: newRecord.category || null,
      start_time: newRecord.startTime,
      end_time: newRecord.endTime,
      duration: newRecord.duration,
      created_at: Date.now(),
    }).then(() => {
      console.log("[useTimerHistory] Record saved to database successfully");
    }).catch(error => {
      console.error("[useTimerHistory] Failed to save record to database:", error);
    });
  }

  /**
   * 删除指定记录
   */
  function deleteRecord(id: string) {
    const index = records.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      records.value.splice(index, 1);
      deleteRecordDB(id).catch(error => {
        console.error("Failed to delete record from database:", error);
      });
    }
  }

  /**
   * 清空所有记录
   */
  async function clearRecords() {
    try {
      await clearRecordsDB();
      records.value = [];
      console.log("✓ All records cleared from database");
    } catch (error) {
      console.error("Failed to clear records from database:", error);
    }
  }

  /**
   * 获取今天的记录
   */
  function getTodayRecords(): TimerRecord[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    return records.value.filter((r) => r.endTime >= todayStart);
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
    
    return records.value.filter((r) => r.endTime >= weekStart);
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
    loadRecords,
  };
}
