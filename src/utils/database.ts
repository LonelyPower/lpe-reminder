import { invoke } from "@tauri-apps/api/core";

export interface User {
  id: number;
  device_id: string;
  phone: string | null;
  created_at: number;
  updated_at: number;
}

export interface Setting {
  id: number;
  user_id: number;
  key: string;
  value: string;
  updated_at: number;
}

export interface TimerRecord {
  id: string;
  user_id: number;
  record_type: string;
  mode: string | null;
  name: string | null;
  category: string | null;
  start_time: number;
  end_time: number;
  duration: number;
  created_at: number;
}

let currentUser: User | null = null;

/**
 * 获取或创建设备唯一标识
 */
export async function getDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem("device_id");
  
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("device_id", deviceId);
  }
  
  return deviceId;
}

/**
 * 初始化数据库和用户
 */
export async function initDatabase(): Promise<User> {
  if (currentUser) return currentUser;

  const deviceId = await getDeviceId();
  currentUser = await invoke<User>("db_init_user", { deviceId });
  
  console.log("✓ Database and user initialized:", currentUser);
  return currentUser;
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User> {
  if (currentUser) return currentUser;
  return await initDatabase();
}

/**
 * 更新用户手机号
 */
export async function updateUserPhone(phone: string | null): Promise<void> {
  await invoke("db_update_phone", { phone });
  
  if (currentUser) {
    currentUser.phone = phone;
  }
  
  console.log("✓ User phone updated");
}

/**
 * 获取用户手机号
 */
export async function getUserPhone(): Promise<string | null> {
  const user = await invoke<User>("db_get_user");
  return user.phone;
}

/**
 * 获取所有设置
 */
export async function getSettings(): Promise<Setting[]> {
  return await invoke<Setting[]>("db_get_settings");
}

/**
 * 保存单个设置
 */
export async function saveSetting(key: string, value: string): Promise<void> {
  await invoke("db_save_setting", { key, value });
}

/**
 * 批量保存设置
 */
export async function saveSettingsBatch(settings: Array<[string, string]>): Promise<void> {
  await invoke("db_save_settings_batch", { settings });
}

/**
 * 获取计时记录
 */
export async function getTimerRecords(limit: number = 100): Promise<TimerRecord[]> {
  return await invoke<TimerRecord[]>("db_get_timer_records", { limit });
}

/**
 * 添加计时记录
 */
export async function addTimerRecord(record: Omit<TimerRecord, "user_id">): Promise<void> {
  const user = await getCurrentUser();
  const fullRecord: TimerRecord = {
    ...record,
    user_id: user.id,
  };
  await invoke("db_add_timer_record", { record: fullRecord });
}

/**
 * 更新计时记录
 */
export async function updateTimerRecord(recordId: string, updates: Partial<Pick<TimerRecord, "name" | "category">>): Promise<void> {
  await invoke("db_update_timer_record", { recordId, updates });
}

/**
 * 删除计时记录
 */
export async function deleteTimerRecord(recordId: string): Promise<void> {
  await invoke("db_delete_timer_record", { recordId });
}

/**
 * 清空所有计时记录
 */
export async function clearTimerRecords(): Promise<void> {
  await invoke("db_clear_timer_records");
}


