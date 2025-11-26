import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  // 使用 SQLite 数据库，存储在应用数据目录
  db = await Database.load("sqlite:lpe_reminder.db");

  // 创建表结构
  await createTables();

  return db;
}

/**
 * 创建数据库表结构
 */
async function createTables() {
  if (!db) throw new Error("Database not initialized");

  // 1. 用户表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      phone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 2. 设置表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, key)
    )
  `);

  // 3. 计时记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS timer_records (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      mode TEXT,
      name TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建索引
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_timer_records_user_id 
    ON timer_records(user_id)
  `);
  
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_timer_records_end_time 
    ON timer_records(end_time DESC)
  `);

  console.log("✓ Database tables created successfully");
}

/**
 * 获取或创建设备唯一标识
 */
export async function getDeviceId(): Promise<string> {
  // 尝试从 localStorage 读取
  let deviceId = localStorage.getItem("device_id");
  
  if (!deviceId) {
    // 生成新的设备 ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("device_id", deviceId);
  }
  
  return deviceId;
}

/**
 * 获取或创建当前用户
 */
export async function getCurrentUser(): Promise<number> {
  if (!db) await initDatabase();
  
  const deviceId = await getDeviceId();
  
  // 查找现有用户
  const users = await db!.select<Array<{ id: number }>>(
    "SELECT id FROM users WHERE device_id = $1",
    [deviceId]
  );
  
  if (users.length > 0) {
    return users[0].id;
  }
  
  // 创建新用户
  const now = Date.now();
  const result = await db!.execute(
    "INSERT INTO users (device_id, created_at, updated_at) VALUES ($1, $2, $3)",
    [deviceId, now, now]
  );
  
  console.log("✓ New user created:", result);
  
  // 获取新创建的用户 ID
  const newUsers = await db!.select<Array<{ id: number }>>(
    "SELECT id FROM users WHERE device_id = $1",
    [deviceId]
  );
  
  return newUsers[0].id;
}

/**
 * 更新用户手机号
 */
export async function updateUserPhone(phone: string | null): Promise<void> {
  if (!db) await initDatabase();
  
  const userId = await getCurrentUser();
  const now = Date.now();
  
  await db!.execute(
    "UPDATE users SET phone = $1, updated_at = $2 WHERE id = $3",
    [phone, now, userId]
  );
  
  console.log("✓ User phone updated");
}

/**
 * 获取用户手机号
 */
export async function getUserPhone(): Promise<string | null> {
  if (!db) await initDatabase();
  
  const userId = await getCurrentUser();
  
  const users = await db!.select<Array<{ phone: string | null }>>(
    "SELECT phone FROM users WHERE id = $1",
    [userId]
  );
  
  return users.length > 0 ? users[0].phone : null;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

/**
 * 从 localStorage 迁移数据到 SQLite
 */
export async function migrateFromLocalStorage(): Promise<void> {
  console.log("Starting migration from localStorage to SQLite...");
  
  await initDatabase();
  const userId = await getCurrentUser();
  
  // 1. 迁移设置
  const settingsData = localStorage.getItem("lpe-reminder-settings");
  if (settingsData) {
    try {
      const settings = JSON.parse(settingsData);
      const now = Date.now();
      
      for (const [key, value] of Object.entries(settings)) {
        await db!.execute(
          `INSERT OR REPLACE INTO settings (user_id, key, value, updated_at) 
           VALUES ($1, $2, $3, $4)`,
          [userId, key, JSON.stringify(value), now]
        );
      }
      
      console.log("✓ Settings migrated");
      // 备份后删除
      localStorage.setItem("lpe-reminder-settings-backup", settingsData);
      localStorage.removeItem("lpe-reminder-settings");
    } catch (e) {
      console.error("Failed to migrate settings:", e);
    }
  }
  
  // 2. 迁移历史记录
  const historyData = localStorage.getItem("lpe-reminder-history");
  if (historyData) {
    try {
      const records = JSON.parse(historyData);
      const now = Date.now();
      
      for (const record of records) {
        await db!.execute(
          `INSERT OR IGNORE INTO timer_records 
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
      }
      
      console.log(`✓ ${records.length} history records migrated`);
      // 备份后删除
      localStorage.setItem("lpe-reminder-history-backup", historyData);
      localStorage.removeItem("lpe-reminder-history");
    } catch (e) {
      console.error("Failed to migrate history:", e);
    }
  }
  
  console.log("✓ Migration completed");
}
