import { ref } from "vue";
import { initDatabase, getCurrentUser, getDatabase } from "../utils/database";

export interface TimerRecord {
  id: string;
  type: "countdown" | "stopwatch";
  startTime: number;
  endTime: number;
  duration: number;
  mode?: "work" | "break";
  name?: string;
}

const records = ref<TimerRecord[]>([]);
let userId: number | null = null;
let initialized = false;

/**
 * 从数据库加载历史记录
 */
async function loadRecords(): Promise<void> {
  try {
    await initDatabase();
    userId = await getCurrentUser();
    const db = getDatabase();
    
    const rows = await db.select<Array<{
      id: string;
      type: string;
      mode: string | null;
      name: string | null;
      start_time: number;
      end_time: number;
      duration: number;
    }>>(
      `SELECT id, type, mode, name, start_time, end_time, duration 
       FROM timer_records 
       WHERE user_id = $1 
       ORDER BY end_time DESC 
       LIMIT 100`,
      [userId]
    );
    
    records.value = rows.map(row => ({
      id: row.id,
      type: row.type as "countdown" | "stopwatch",
      mode: row.mode as "work" | "break" | undefined,
      name: row.name || undefined,
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

/**
 * 保存记录到数据库
 */
async function saveRecord(record: TimerRecord): Promise<void> {
  if (!userId) return;
  
  try {
    const db = getDatabase();
    const now = Date.now();
    
    await db.execute(
      `INSERT INTO timer_records 
       (id, user_id, type, mode, name, start_time, end_time, duration, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        record.id,
        userId,
        record.type,
        record.mode || null,
        record.name || null,
        record.startTime,
        record.endTime,
        record.duration,
        now
      ]
    );
    
    console.log("✓ Record saved to database:", record.id);
  } catch (error) {
    console.error("Failed to save record to database:", error);
  }
}

/**
 * 从数据库删除记录
 */
async function deleteRecordFromDB(id: string): Promise<void> {
  if (!userId) return;
  
  try {
    const db = getDatabase();
    
    await db.execute(
      "DELETE FROM timer_records WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    
    console.log("✓ Record deleted from database:", id);
  } catch (error) {
    console.error("Failed to delete record from database:", error);
  }
}

export function useTimerHistory() {
  // 初始化（仅执行一次）
  if (!initialized) {
    initialized = true;
    loadRecords();
  }
  
  /**
   * 添加一条新记录
   */
  function addRecord(record: Omit<TimerRecord, "id">) {
    const newRecord: TimerRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    // 添加到内存
    records.value.unshift(newRecord);
    
    // 保持最多 100 条
    if (records.value.length > 100) {
      records.value = records.value.slice(0, 100);
    }
    
    // 保存到数据库
    saveRecord(newRecord);
  }

  /**
   * 删除指定记录
   */
  function deleteRecord(id: string) {
    const index = records.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      records.value.splice(index, 1);
      deleteRecordFromDB(id);
    }
  }

  /**
   * 清空所有记录
   */
  async function clearRecords() {
    if (!userId) return;
    
    try {
      const db = getDatabase();
      await db.execute(
        "DELETE FROM timer_records WHERE user_id = $1",
        [userId]
      );
      
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
  };
}
