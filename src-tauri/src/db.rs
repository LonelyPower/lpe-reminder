use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i64,
    pub device_id: String,
    pub phone: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub id: i64,
    pub user_id: i64,
    pub key: String,
    pub value: String,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimerRecord {
    pub id: String,
    pub user_id: i64,
    pub record_type: String,
    pub mode: Option<String>,
    pub name: Option<String>,
    pub category: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub duration: i64,
    pub created_at: i64,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 创建用户表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                phone TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建设置表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, key)
            )",
            [],
        )?;

        // 创建计时记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS timer_records (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                record_type TEXT NOT NULL,
                mode TEXT,
                name TEXT,
                category TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )",
            [],
        )?;

        // 为已存在的表添加 category 列（如果不存在）
        let _ = conn.execute(
            "ALTER TABLE timer_records ADD COLUMN category TEXT",
            [],
        );

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_timer_records_user_id 
             ON timer_records(user_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_timer_records_end_time 
             ON timer_records(end_time DESC)",
            [],
        )?;

        println!("✓ Database tables initialized");
        Ok(())
    }

    // 用户相关操作
    pub fn get_or_create_user(&self, device_id: &str) -> Result<User> {
        let conn = self.conn.lock().unwrap();

        // 尝试查找现有用户
        let mut stmt = conn.prepare("SELECT id, device_id, phone, created_at, updated_at FROM users WHERE device_id = ?1")?;
        let user_result = stmt.query_row(params![device_id], |row| {
            Ok(User {
                id: row.get(0)?,
                device_id: row.get(1)?,
                phone: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        });

        match user_result {
            Ok(user) => Ok(user),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 创建新用户
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64;

                conn.execute(
                    "INSERT INTO users (device_id, created_at, updated_at) VALUES (?1, ?2, ?3)",
                    params![device_id, now, now],
                )?;

                let user_id = conn.last_insert_rowid();
                println!("✓ New user created with ID: {}", user_id);

                Ok(User {
                    id: user_id,
                    device_id: device_id.to_string(),
                    phone: None,
                    created_at: now,
                    updated_at: now,
                })
            }
            Err(e) => Err(e),
        }
    }

    pub fn update_user_phone(&self, user_id: i64, phone: Option<String>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        conn.execute(
            "UPDATE users SET phone = ?1, updated_at = ?2 WHERE id = ?3",
            params![phone, now, user_id],
        )?;

        println!("✓ User phone updated");
        Ok(())
    }

    pub fn get_user_by_id(&self, user_id: i64) -> Result<User> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, device_id, phone, created_at, updated_at FROM users WHERE id = ?1"
        )?;
        
        stmt.query_row(params![user_id], |row| {
            Ok(User {
                id: row.get(0)?,
                device_id: row.get(1)?,
                phone: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
    }

    // 设置相关操作
    pub fn get_settings(&self, user_id: i64) -> Result<Vec<Setting>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, key, value, updated_at FROM settings WHERE user_id = ?1"
        )?;

        let settings = stmt
            .query_map(params![user_id], |row| {
                Ok(Setting {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    key: row.get(2)?,
                    value: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(settings)
    }

    pub fn save_setting(&self, user_id: i64, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        conn.execute(
            "INSERT OR REPLACE INTO settings (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![user_id, key, value, now],
        )?;

        Ok(())
    }

    pub fn save_settings_batch(&self, user_id: i64, settings: Vec<(String, String)>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        for (key, value) in settings {
            conn.execute(
                "INSERT OR REPLACE INTO settings (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params![user_id, &key, &value, now],
            )?;
        }

        println!("✓ Settings batch saved");
        Ok(())
    }

    // 计时记录相关操作
    pub fn get_timer_records(&self, user_id: i64, limit: i64) -> Result<Vec<TimerRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, record_type, mode, name, category, start_time, end_time, duration, created_at 
             FROM timer_records 
             WHERE user_id = ?1 
             ORDER BY end_time DESC 
             LIMIT ?2"
        )?;

        let records = stmt
            .query_map(params![user_id, limit], |row| {
                Ok(TimerRecord {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    record_type: row.get(2)?,
                    mode: row.get(3)?,
                    name: row.get(4)?,
                    category: row.get(5)?,
                    start_time: row.get(6)?,
                    end_time: row.get(7)?,
                    duration: row.get(8)?,
                    created_at: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(records)
    }

    pub fn add_timer_record(&self, record: &TimerRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO timer_records 
             (id, user_id, record_type, mode, name, category, start_time, end_time, duration, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                record.id,
                record.user_id,
                record.record_type,
                record.mode,
                record.name,
                record.category,
                record.start_time,
                record.end_time,
                record.duration,
                record.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn update_timer_record(&self, user_id: i64, record_id: i64, name: Option<String>, category: Option<String>) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 构建动态 SQL
        let mut updates = Vec::new();
        let mut params_list: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(n) = name {
            updates.push("name = ?");
            params_list.push(Box::new(n));
        }

        if let Some(c) = category {
            updates.push("category = ?");
            params_list.push(Box::new(c));
        }

        if updates.is_empty() {
            return Ok(()); // 无需更新
        }

        // 添加 user_id 和 record_id 到参数列表
        params_list.push(Box::new(record_id));
        params_list.push(Box::new(user_id));

        let sql = format!(
            "UPDATE timer_records SET {} WHERE id = ? AND user_id = ?",
            updates.join(", ")
        );

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_list.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())?;

        Ok(())
    }

    pub fn delete_timer_record(&self, user_id: i64, record_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM timer_records WHERE id = ?1 AND user_id = ?2",
            params![record_id, user_id],
        )?;

        Ok(())
    }

    pub fn clear_timer_records(&self, user_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "DELETE FROM timer_records WHERE user_id = ?1",
            params![user_id],
        )?;

        println!("✓ All timer records cleared for user {}", user_id);
        Ok(())
    }
}
