# LPE Reminder - AI 编程指令手册

> **架构核心**: Rust 主导数据持久化，Vue 专注 UI 渲染，双窗口通过 Tauri Event 同步

## 🏗️ 技术栈与核心决策

- **前端**: Vue 3.5 (Composition API) + TypeScript 5.6 + Vite 6.0 多入口构建
- **后端**: Tauri v2 + Rust (SQLite 通过 `rusqlite` 直接管理)
- **包管理**: **pnpm 强制使用** (npm/yarn 禁止)
- **数据架构**: **前端禁止直接操作数据库**，所有 CRUD 通过 Rust Tauri Commands 完成
- **窗口系统**: 主窗口 (main) + 悬浮窗 (float)，独立 HTML 入口，通过 Tauri Event 双向通信

## 📂 关键文件路径速查

### 前端入口 (双窗口架构)
- `index.html` + `src/main.ts` → 主窗口 (label: "main")
- `float-window.html` + `src/float-main.ts` → 悬浮窗 (label: "float")
- `vite.config.ts` 配置多入口构建，端口固定 1420

### 业务逻辑层 (平台无关)
- `src/composables/useTimer.ts` - 倒计时状态机 (200ms tick + Date.now() 防漂移)
- `src/composables/useStopwatch.ts` - 正计时器 (支持工作后强制休息)
- `src/composables/useSettingsDB.ts` - 设置管理 (通过 Rust 读写 SQLite)
- `src/composables/useTimerHistoryDB.ts` - 历史记录 (同上)

### Rust 数据层 (唯一数据源)
- `src-tauri/src/db.rs` - SQLite 操作封装 (users/settings/timer_records 三表)
- `src-tauri/src/lib.rs` - Tauri Commands 注册 + 托盘图标缓存 (IconCache)
- `src-tauri/capabilities/default.json` - 权限白名单 (**新增 API 必须声明**)

### UI 组件 (纯展示层)
- `src/App.vue` - 主窗口根组件 (协调计时器/设置/历史面板切换)
- `src/components/FloatingWindow.vue` - 悬浮窗 (接收 `timer-state-sync` 事件同步状态)

---

## 🏗️ 核心架构模式

### 1. 数据流架构 (前端 → Rust → SQLite)

```
┌─ Vue 前端 ─────────────────────────────────────┐
│  useSettingsDB.ts (reactive settings)          │
│       ↓ watch 自动触发                          │
│  saveSetting(key, value)                       │
└────────────────┬───────────────────────────────┘
                 │ invoke("db_save_setting")
┌────────────────▼───────────────────────────────┐
│  Rust Backend (src-tauri/src/lib.rs)           │
│  #[tauri::command]                             │
│  fn db_save_setting(key, value, state) {...}   │
└────────────────┬───────────────────────────────┘
                 │ state.db.lock().unwrap()
┌────────────────▼───────────────────────────────┐
│  SQLite Database (db.rs)                       │
│  INSERT OR REPLACE INTO settings...            │
└────────────────────────────────────────────────┘
```

**关键原则**:
- 前端 `src/utils/database.ts` 仅封装 `invoke()` 调用，不含业务逻辑
- 所有数据验证/事务管理在 Rust 层完成
- `currentUser` 在 `initDatabase()` 时缓存到 `AppState.current_user_id`

### 2. 双窗口同步机制 (Main ↔ Float)

```typescript
// 主窗口 → 悬浮窗 (App.vue)
watch([timer.mode, timer.remainingMs, timer.isRunning], async () => {
  await appWindow.emit("timer-state-sync", {
    timerMode: settings.timerMode,
    mode: timer.mode.value,
    remainingMs: timer.remainingMs.value,
    isRunning: timer.isRunning.value,
    isBreakMode: timer.mode.value === "break",
    breakElapsedMs: timer.breakElapsedMs.value
  })
})

// 悬浮窗 → 主窗口 (FloatingWindow.vue)
async function handleClick() {
  if (isRunning.value) {
    await mainWindow.emit("float-pause", {})
  } else {
    await mainWindow.emit("float-start", {})
  }
}
```

**设计要点**:
- 主窗口是状态的 **唯一真实来源** (single source of truth)
- 悬浮窗通过 `listen("timer-state-sync")` 被动接收状态
- 悬浮窗操作通过 `emit("float-*")` 请求主窗口执行，不直接修改状态

### 3. 计时器状态机 (防漂移设计)

```typescript
// useTimer.ts 核心机制
let lastTick = 0;
function tick(now: number) {
  const delta = now - lastTick;  // 计算真实流逝时间
  lastTick = now;
  
  if (mode.value === "work") {
    remainingMs.value = Math.max(0, remainingMs.value - delta);
    if (remainingMs.value <= 0) {
      setMode("break");
      options.onWorkEnd?.();  // 触发休息流程
    }
  }
}

setInterval(() => tick(Date.now()), 200);
```

**为什么不用 `setInterval(1000)` 直接减 1000ms?**
- `setInterval` 存在累积误差 (受事件循环阻塞影响)
- 使用 `Date.now()` 基于系统时钟，确保长时间运行精度

---

## 🎯 关键实现细节

### 1. SQLite 数据库初始化流程

```typescript
// 1. 前端获取/生成设备 ID (database.ts)
export async function getDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

// 2. 调用 Rust 初始化用户
const deviceId = await getDeviceId();
currentUser = await invoke<User>("db_init_user", { deviceId });
```

```rust
// 3. Rust 侧创建/获取用户 (db.rs)
pub fn get_or_create_user(&self, device_id: &str) -> Result<User> {
  let conn = self.conn.lock().unwrap();
  
  // 尝试查找现有用户
  match conn.query_row(...) {
    Ok(user) => Ok(user),
    Err(rusqlite::Error::QueryReturnedNoRows) => {
      // 创建新用户
      let now = now_timestamp();
      conn.execute("INSERT INTO users ...", params![device_id, now, now])?;
      // 返回新创建的用户
    }
  }
}
```

**数据库文件位置**: 
- Windows: `%APPDATA%\com.lonelypower.lpe-reminder\lpe_reminder.db`
- macOS: `~/Library/Application Support/com.lonelypower.lpe-reminder/lpe_reminder.db`
- Linux: `~/.local/share/com.lonelypower.lpe-reminder/lpe_reminder.db`

### 2. 设置自动持久化机制

```typescript
// useSettingsDB.ts
const settings = reactive<AppSettings>({ ...defaultSettings });

// 监听所有设置变化
watch(settings, async (newSettings) => {
  const pairs = Object.entries(newSettings).map(([key, value]) => [
    key,
    JSON.stringify(value)
  ]);
  await saveSetting(pairs[0][0], pairs[0][1]);  // 示例：单个保存
}, { deep: true });
```

**注意**: 当前实现对每个设置项单独调用 `saveSetting`，可考虑批量优化 (`db_save_settings_batch`)

### 3. 托盘图标缓存优化

```rust
// lib.rs - IconCache 避免重复加载图标
pub struct IconCache {
  icons: HashMap<String, (Vec<u8>, u32, u32)>, // (rgba_data, width, height)
}

// 在 setup() 中预加载所有图标
fn load_tray_icons(app: &AppHandle, cache: &mut IconCache) {
  for (key, filename) in [("idle", "idle.png"), ("busy", "busy.png"), ...] {
    if let Ok(img) = image::open(path) {
      let rgba = img.to_rgba8();
      cache.insert(key.to_string(), rgba.to_vec(), rgba.width(), rgba.height());
    }
  }
}

// 使用时零延迟
fn set_tray_icon(state: &str, cache: &IconCache) {
  if let Some(icon) = cache.get_icon(state) {
    tray.set_icon(Some(icon))?;  // 直接使用内存中的数据
  }
}
```

### 4. 错误处理模式 (safeExecute)

```typescript
// utils/errorHandler.ts
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[Error] ${context}:`, error);
    return null;  // 失败时返回 null，不中断主流程
  }
}

// App.vue 使用示例
await safeExecute(async () => {
  await win.setAlwaysOnTop(true);
  await win.setFocus();
}, "Show and focus window on work end");
```

**设计理念**: 
- 非关键操作失败不应导致应用崩溃
- 所有错误统一记录到控制台，便于调试

---

## 🛠️ 开发工作流

### 日常开发命令
```bash
# ⚠️ 必须使用 tauri dev，禁止直接运行 vite dev
pnpm tauri dev
# 原因: 直接运行 vite 缺少 Tauri API 上下文，所有 invoke/listen 会失败

# 类型检查 (建议开发前运行)
pnpm run build  # 等价于 vue-tsc --noEmit && vite build
```

**热重载行为**:
- Vue 文件修改 → Vite HMR 即时更新
- Rust 文件修改 → 需要重启 `pnpm tauri dev`

### 生产构建
```bash
# 桌面端
pnpm tauri build
# 输出位置: src-tauri/target/release/bundle/

# Android 端 (需预先安装 Android SDK)
pnpm tauri android build
```

### 添加新的 Tauri Command

1. **定义 Rust 命令**
```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn my_new_command(param: String, state: State<AppState>) -> Result<String, String> {
  // 实现逻辑
  Ok("success".to_string())
}
```

2. **注册到 invoke_handler**
```rust
.invoke_handler(tauri::generate_handler![
  greet,
  set_tray_icon,
  my_new_command,  // 添加这里
])
```

3. **前端调用**
```typescript
import { invoke } from "@tauri-apps/api/core"
const result = await invoke<string>("my_new_command", { param: "value" })
```

### 添加新的 Tauri 插件
**完整流程** (以添加 `dialog` 插件为例):

1. **安装依赖**
```bash
# Rust 侧
# 在 src-tauri/Cargo.toml [dependencies] 添加:
tauri-plugin-dialog = "2"

# TypeScript 侧
pnpm add @tauri-apps/plugin-dialog
```

2. **初始化插件**
```rust
// src-tauri/src/lib.rs
.plugin(tauri_plugin_dialog::init())
```

3. **配置权限**
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "dialog:default"
  ]
}
```

4. **前端调用**
```typescript
import { open } from "@tauri-apps/plugin-dialog"
const selected = await open({ directory: true })
```

---

## 🚨 常见错误与解决方案

### 1. "failed to resolve command" 错误
**原因**: Rust 命令未注册到 `invoke_handler`  
**解决**:
```rust
.invoke_handler(tauri::generate_handler![
  greet,
  set_tray_icon,
  update_tray_menu,
  app_exit,  // 确保所有命令都在这里
])
```

### 2. 窗口关闭无响应
**原因**: 未调用 `event.preventDefault()`  
**解决**:
```typescript
await getCurrentWindow().onCloseRequested(async (event) => {
  event.preventDefault()  // ⚠️ 必须在最前面
  // 后续处理逻辑
})
```

### 3. 托盘图标不显示
**检查清单**:
- [ ] 图标文件存在于 `src-tauri/icons/` 目录
- [ ] 文件名拼写正确 (区分大小写)
- [ ] `capabilities/default.json` 包含 `"core:tray:default"` 权限
- [ ] Rust 侧 `image` crate 已添加到 `Cargo.toml`

### 4. 数据库相关错误
**症状**: `invoke("db_*")` 命令失败  
**检查顺序**:
1. 确认 `initDatabase()` 在 App.vue 的 `onMounted` 中被调用
2. 检查 `currentUser` 是否成功初始化
3. 查看 Rust 控制台日志 (终端输出)
4. 验证 SQLite 文件是否存在于 AppData 目录

---

## 📋 代码规范与最佳实践

### TypeScript 规范
```typescript
// ✅ 使用 interface 定义所有公共 API
export interface AppSettings {
  workDurationMinutes: number
  // ...
}

// ✅ 避免 any，使用具体类型
const handleEvent = (data: TimerEvent) => { /* ... */ }

// ❌ 禁止
const handleEvent = (data: any) => { /* ... */ }

// ✅ 使用类型守卫
if (typeof value === "string") {
  // TypeScript 自动推断 value 为 string
}
```

### Vue 组件规范
```vue
<script setup lang="ts">
// ✅ Props 使用 TypeScript 接口
interface Props {
  mode: "idle" | "work" | "break"
  remainingMs: number
}
const props = defineProps<Props>()

// ✅ Emits 明确声明事件类型
const emit = defineEmits<{
  (e: "start"): void
  (e: "pause"): void
}>()

// ❌ 避免在组件内直接修改 props
props.remainingMs = 1000  // 错误!
// ✅ 通过 emit 请求父组件修改
emit("update:remainingMs", 1000)
</script>

<style scoped>
/* ✅ 所有样式使用 scoped 避免污染全局 */
</style>
```

### Rust 规范
```rust
// ✅ 命令函数使用 snake_case
#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, state: &str) { /* ... */ }

// ✅ 错误处理使用 Result<T, E>
#[tauri::command]
fn risky_operation() -> Result<String, String> {
  // ...
}

// ✅ 日志使用 println! (开发) 或 log crate (生产)
println!("Tray icon updated to: {}", state);
```

---

## 📚 关键文件速查

| 文件路径 | 职责 | 修改频率 | 注意事项 |
|---------|-----|---------|---------|
| `src/App.vue` | 生命周期协调者 | 中 | 处理窗口/托盘/音频/通知事件 |
| `src/composables/useTimer.ts` | 计时器状态机 | 高 | 修改计时逻辑的唯一入口 |
| `src/composables/useSettings.ts` | 设置管理 | 中 | 新增设置项需同步更新接口 |
| `src/components/*.vue` | UI 组件 | 中 | 纯展示组件，禁止内部状态 |
| `src-tauri/src/lib.rs` | Tauri 核心 | 高 | 所有命令/插件/托盘逻辑 |
| `src-tauri/Cargo.toml` | Rust 依赖 | 低 | 添加新插件时修改 |
| `src-tauri/tauri.conf.json` | Tauri 配置 | 低 | 窗口尺寸/打包参数 |
| `src-tauri/capabilities/default.json` | 权限配置 | 中 | 新增命令必须声明权限 |
| `vite.config.ts` | Vite 配置 | 极低 | 端口 1420 固定，勿修改 |

---

## 🎓 进阶主题

### 跨平台代码复用策略
```typescript
// ✅ 平台无关逻辑 (可在移动端复用)
// src/composables/useTimer.ts
export function useTimer() {
  // 纯 TypeScript + Vue Reactivity
  // 不依赖任何 Tauri API
}

// ✅ 平台特定逻辑 (仅桌面端)
// src/App.vue
import { getCurrentWindow } from "@tauri-apps/api/window"
// 移动端需替换为 Capacitor API
```

### 性能优化建议
1. **计时器优化**: 200ms 间隔足够平滑，避免使用 requestAnimationFrame (功耗高)
2. **Teleport 使用**: `BreakOverlay` 使用 `<teleport to="body">` 避免 z-index 层叠问题
3. **watch 节流**: 如需监听高频变化，使用 `throttle` 包装
4. **音频预加载**: 考虑在 onMounted 时预加载音频文件

### 未来扩展方向
1. **眨眼检测**: 使用 WebRTC + TensorFlow.js 或调用原生摄像头 API
2. **统计图表**: 每日/每周工作时长统计 (需添加数据库支持)
3. **多语言**: 使用 vue-i18n 实现国际化
4. **云同步**: 通过 Tauri HTTP 插件同步设置到云端
5. **自定义主题**: CSS 变量 + 主题切换功能

---

## 🔧 故障排查检查清单

### 开发环境问题
- [ ] 确认使用 `pnpm tauri dev` 而非 `pnpm dev`
- [ ] 确认 Rust 工具链已安装 (`rustc --version`)
- [ ] 确认端口 1420 未被占用
- [ ] 确认 `pnpm-lock.yaml` 与 `package.json` 同步

### 构建问题
- [ ] 运行 `pnpm run build` 检查 TypeScript 类型错误
- [ ] 检查 Rust 编译警告 (`cargo check --manifest-path src-tauri/Cargo.toml`)
- [ ] 确认所有静态资源存在于 `public/` 目录
- [ ] 检查 `src-tauri/capabilities/default.json` 权限配置

### 运行时问题
- [ ] 检查浏览器控制台 (Tauri 中按 F12)
- [ ] 检查 Rust 日志输出 (终端中查看)
- [ ] 使用 `console.log` / `println!` 逐步调试
- [ ] 验证 SQLite 数据格式 (检查 AppData 目录中的 .db 文件)

---

## 🚀 快速启动指南

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm tauri dev

# 3. 构建生产版本
pnpm tauri build

# 4. 类型检查 (可选)
pnpm run build
```

**首次运行注意事项**:
- Windows 用户需安装 WebView2 (Tauri 会自动提示)
- macOS 用户需授予辅助功能权限 (通知功能需要)
- Linux 用户需安装 webkit2gtk 依赖

---

## 📞 技术支持资源
- [Tauri 官方文档](https://tauri.app)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- 本项目 GitHub Issues (待添加链接)
