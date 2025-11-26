# SQLite 数据存储迁移指南

## 📦 已完成的功能

### 1. **SQLite 插件集成**
- ✅ 添加 `@tauri-apps/plugin-sql` 依赖
- ✅ 配置 Rust 端插件和权限
- ✅ 创建数据库初始化模块

### 2. **数据库表结构**

#### `users` 表 - 用户信息
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| device_id | TEXT | 设备唯一标识（UNIQUE） |
| phone | TEXT | 手机号（可选） |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

#### `settings` 表 - 设置信息
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| user_id | INTEGER | 用户 ID（外键） |
| key | TEXT | 设置键名 |
| value | TEXT | 设置值（JSON 格式） |
| updated_at | INTEGER | 更新时间戳 |

**唯一约束**: `(user_id, key)` 组合唯一

#### `timer_records` 表 - 计时记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID 格式 |
| user_id | INTEGER | 用户 ID（外键） |
| type | TEXT | 记录类型（countdown/stopwatch） |
| mode | TEXT | 模式（work/break） |
| name | TEXT | 记录名称（可选） |
| start_time | INTEGER | 开始时间戳 |
| end_time | INTEGER | 结束时间戳 |
| duration | INTEGER | 持续时长（毫秒） |
| created_at | INTEGER | 创建时间戳 |

**索引**:
- `idx_timer_records_user_id`: 用户 ID 索引
- `idx_timer_records_end_time`: 结束时间倒序索引

### 3. **核心功能模块**

#### `src/utils/database.ts`
- `initDatabase()`: 初始化数据库连接
- `getDeviceId()`: 获取设备唯一标识
- `getCurrentUser()`: 获取或创建当前用户
- `updateUserPhone()`: 更新手机号
- `getUserPhone()`: 获取手机号
- `migrateFromLocalStorage()`: 从 localStorage 迁移数据

#### `src/composables/useSettingsDB.ts`
- 替代原 `useSettings.ts`
- 使用 SQLite 存储设置
- 自动加载和保存设置

#### `src/composables/useTimerHistoryDB.ts`
- 替代原 `useTimerHistory.ts`
- 使用 SQLite 存储历史记录
- 支持最多 100 条记录

#### `src/components/UserInfoSection.vue`
- 显示设备标识
- 手机号输入和保存

### 4. **数据迁移**

应用启动时自动检测 localStorage 中的旧数据：
1. 如果发现旧数据，自动迁移到 SQLite
2. 迁移后将旧数据备份为 `*-backup` 键
3. 删除原始 localStorage 数据

**迁移内容**:
- ✅ 所有设置项
- ✅ 所有历史记录

## 🚀 使用方法

### 安装依赖
```bash
# 前端依赖（已完成）
pnpm add @tauri-apps/plugin-sql

# Rust 依赖（已在 Cargo.toml 中添加）
# tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

### 启动应用
```bash
pnpm tauri dev
```

首次启动时会：
1. 自动创建数据库文件 `lpe_reminder.db`
2. 检测并迁移 localStorage 数据
3. 初始化用户信息

### 数据库位置

SQLite 数据库文件存储在 Tauri 应用数据目录：
- **Windows**: `%APPDATA%\com.lpe-reminder.app\lpe_reminder.db`
- **macOS**: `~/Library/Application Support/com.lpe-reminder.app/lpe_reminder.db`
- **Linux**: `~/.local/share/com.lpe-reminder.app/lpe_reminder.db`

## 📝 API 使用示例

### 获取用户信息
```typescript
import { getDeviceId, getUserPhone } from "@/utils/database";

const deviceId = await getDeviceId();
const phone = await getUserPhone();
```

### 更新手机号
```typescript
import { updateUserPhone } from "@/utils/database";

await updateUserPhone("13800138000");
// 或清除手机号
await updateUserPhone(null);
```

### 使用设置
```typescript
import { useSettings } from "@/composables/useSettingsDB";

const { settings } = useSettings();
// settings 会自动从数据库加载并保存
settings.workDurationMinutes = 30;
```

### 使用历史记录
```typescript
import { useTimerHistory } from "@/composables/useTimerHistoryDB";

const { records, addRecord } = useTimerHistory();
// records 会自动从数据库加载
addRecord({
  type: "countdown",
  mode: "work",
  startTime: Date.now() - 1500000,
  endTime: Date.now(),
  duration: 1500000,
});
```

## 🔧 维护和管理

### 查看数据库内容
可以使用 SQLite 客户端工具（如 DB Browser for SQLite）打开数据库文件查看内容。

### 清除数据
如需重置所有数据，删除数据库文件后重启应用即可：
```bash
# Windows
del "%APPDATA%\com.lpe-reminder.app\lpe_reminder.db"

# macOS/Linux
rm ~/Library/Application\ Support/com.lpe-reminder.app/lpe_reminder.db
```

### 备份数据
直接复制数据库文件即可完成备份：
```bash
# 备份
cp lpe_reminder.db lpe_reminder.backup.db

# 恢复
cp lpe_reminder.backup.db lpe_reminder.db
```

## ⚠️ 注意事项

1. **数据安全**: 设备 ID 和手机号都存储在本地 SQLite 数据库中，不会上传到服务器
2. **性能**: SQLite 适合本地存储，查询速度快，但不支持多设备同步
3. **容量**: 理论上 SQLite 支持 TB 级数据，对于计时记录绰绰有余
4. **迁移**: 首次运行会自动从 localStorage 迁移，无需手动操作

## 🎯 下一步优化建议

1. **云同步**: 可以添加后端 API，将数据同步到云端
2. **多设备支持**: 通过手机号关联多个设备的数据
3. **数据导出**: 添加导出为 CSV/JSON 功能
4. **数据统计**: 基于 SQL 查询实现更复杂的统计功能
5. **数据加密**: 对敏感信息（如手机号）进行加密存储
