# LPE Reminder - AI 编程指令手册

> **架构哲学**: 业务逻辑与UI严格分离，跨平台复用优先，类型安全强制执行

## 🏗️ 项目概览

### 技术栈
- **前端**: Vue 3.5 + TypeScript 5.6 + Vite 6.4 + Composition API (`<script setup>`)
- **桌面壳**: Tauri v2.9 (Rust 1.x)
- **包管理器**: **pnpm** (强制使用，禁止npm/yarn)
- **状态管理**: Vue Composables + Vue Reactivity System
- **数据持久化**: localStorage (前端) / Tauri Store (计划中)
- **目标平台**: Windows/macOS/Linux 桌面 + Android 移动端 (iOS 待定)

### 目录结构规范
```
lpe-reminder/
├── src/                          # 前端代码 (跨平台可复用)
│   ├── main.ts                   # Vue 应用入口
│   ├── App.vue                   # 根组件 (生命周期协调者)
│   ├── components/               # 纯UI组件 (无状态逻辑)
│   │   ├── TimerPanel.vue        # 计时器主面板
│   │   ├── BreakOverlay.vue      # 休息全屏遮罩
│   │   ├── SettingsDialog.vue    # 设置对话框
│   │   └── CloseConfirmDialog.vue # 关闭确认对话框
│   ├── composables/              # 业务逻辑层 (可跨平台复用)
│   │   ├── useTimer.ts           # 计时器状态机 (核心逻辑)
│   │   └── useSettings.ts        # 设置管理 + localStorage持久化
│   └── assets/                   # 静态资源 (图片/字体)
├── public/                       # 公共资源 (打包时直接复制)
│   ├── notification-piano.mp3    # 工作结束提示音
│   └── notification-chime.mp3    # 休息结束提示音
├── src-tauri/                    # Tauri (Rust) 后端代码
│   ├── src/
│   │   ├── main.rs               # 入口 (调用lib.rs::run())
│   │   └── lib.rs                # 核心逻辑 (插件/命令/托盘/菜单)
│   ├── Cargo.toml                # Rust 依赖清单
│   ├── tauri.conf.json           # Tauri 配置 (窗口/构建/打包)
│   ├── capabilities/
│   │   └── default.json          # 权限配置 (IPC/插件白名单)
│   └── icons/                    # 应用图标 + 托盘图标
│       ├── icon.{ico,icns,png}   # 多平台应用图标
│       ├── power-tray-idle.png   # 托盘图标 - 空闲状态
│       ├── power-tray-busy.png   # 托盘图标 - 工作/休息中
│       └── power-tray-pause.png  # 托盘图标 - 暂停状态
├── vite.config.ts                # Vite 构建配置 (端口1420固定)
├── tsconfig.json                 # TypeScript 编译配置
├── package.json                  # 前端依赖 + 脚本命令
└── pnpm-lock.yaml                # 依赖锁定文件 (勿手动修改)
```

---

## 📐 架构设计模式

### 1. 状态管理分层架构
```
┌──────────────────────────────────────────────────────┐
│  UI 层 (Vue Components)                               │
│  - 纯展示组件，通过 props 接收数据                      │
│  - 通过 emit 事件向父组件传递用户操作                   │
│  - 禁止直接修改状态                                     │
└────────────────┬─────────────────────────────────────┘
                 │ Props Down ↓  Events Up ↑
┌────────────────▼─────────────────────────────────────┐
│  业务逻辑层 (Composables)                              │
│  - 封装状态机和业务规则                                │
│  - 返回响应式状态 + 控制方法                           │
│  - 与平台无关，可跨端复用                              │
└────────────────┬─────────────────────────────────────┘
                 │ Tauri Invoke ↓  Tauri Events ↑
┌────────────────▼─────────────────────────────────────┐
│  平台层 (Tauri Rust Backend)                          │
│  - 系统托盘、通知、文件系统等原生功能                   │
│  - 暴露 Tauri Commands 供前端调用                      │
│  - 通过 emit 向前端推送事件                            │
└──────────────────────────────────────────────────────┘
```

**核心原则**:
1. **单向数据流**: Props 向下传递，Events 向上冒泡
2. **逻辑与UI解耦**: Composables 可独立测试，不依赖 DOM
3. **类型安全**: 所有接口定义 TypeScript interface，禁止 `any` 类型

### 2. 计时器状态机 (useTimer.ts)
```typescript
// 状态转换图
idle ──start()──> work ──onWorkEnd()──> break ──onBreakEnd()──> work
 ↑                  │                      │
 └──────reset()─────┴──────skipBreak()────┘

// 关键设计决策
- 使用 setInterval(200ms) + Date.now() 时间戳计算避免累积漂移
- workDurationMs/breakDurationMs 用 ref 包装，支持运行时动态更新
- currentTotalDurationMs 记录当前周期总时长，防止配置变更导致进度条跳变
- onWorkEnd/onBreakEnd 回调由上层 (App.vue) 注入，处理音频/通知/窗口行为
```

**状态更新流程**:
```typescript
// 1. 用户修改设置 (SettingsDialog.vue)
settings.workDurationMinutes = 30

// 2. watch 触发 (App.vue)
watch(() => [settings.workDurationMinutes, ...], () => {
  timer.updateDurations(newWorkMs, newBreakMs)
})

// 3. 如果当前 mode === "idle"，立即更新显示时间
if (mode.value === "idle") {
  remainingMs.value = newWorkMs  // 重置为新的工作时长
}
```

### 3. 设置持久化模式 (useSettings.ts)
```typescript
// 架构设计
const settings = reactive<AppSettings>({ /* 初始值 */ })

// 自动持久化 (深度监听)
watch(settings, (newSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
}, { deep: true })

// 初始化时恢复
const saved = localStorage.getItem(STORAGE_KEY)
if (saved) Object.assign(settings, JSON.parse(saved))
```

**重要**: 
- `settings` 对象在模块顶层创建，全局单例
- 任何修改自动触发持久化，无需手动调用 save()
- 新增字段时需同步更新 `AppSettings` 接口和 `defaultSettings`

### 4. Tauri 命令与事件通信

#### Rust → TypeScript (Tauri Commands)
```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, state: &str) {
  // 修改系统托盘图标/提示文本
}

// 注册到 invoke_handler
.invoke_handler(tauri::generate_handler![
  greet, set_tray_icon, update_tray_menu, app_exit
])
```

```typescript
// src/App.vue (调用侧)
import { invoke } from "@tauri-apps/api/core"
await invoke("set_tray_icon", { state: "working" })
```

#### Rust → TypeScript (事件推送)
```rust
// 托盘菜单点击 (lib.rs)
.on_menu_event(|app, event| match event.id.as_ref() {
  "start" => { app.emit("tray-start", ()).unwrap(); }
  "pause" => { app.emit("tray-pause", ()).unwrap(); }
  // ...
})
```

```typescript
// App.vue (监听侧)
onMounted(async () => {
  await listen("tray-start", () => timer.start())
  await listen("tray-pause", () => timer.pause())
})
```

**权限配置**: 新增命令/插件必须在 `src-tauri/capabilities/default.json` 中声明权限
```json
{
  "permissions": [
    "core:default",
    "core:tray:default",        // 托盘图标
    "core:menu:default",        // 菜单
    "core:window:allow-hide",   // 窗口隐藏
    "notification:default"      // 系统通知
  ]
}
```

---

## 🎯 关键实现规范

### 窗口关闭行为 (三阶段处理)
```typescript
// App.vue onMounted 中注册
await getCurrentWindow().onCloseRequested(async (event) => {
  event.preventDefault() // ⚠️ 必须阻止默认行为，否则窗口直接关闭
  
  const behavior = settings.closeBehavior
  if (behavior === "quit") {
    await invoke("app_exit")  // 调用 Rust 命令退出
  } else if (behavior === "minimize") {
    await getCurrentWindow().hide()  // 隐藏窗口到托盘
  } else {  // behavior === "ask"
    showCloseConfirm.value = true  // 弹出确认对话框
  }
})
```

**用户选择记忆**:
- `CloseConfirmDialog.vue` 提供 "记住我的选择" 复选框
- 勾选后更新 `settings.closeBehavior` (自动持久化到 localStorage)

### 休息模式窗口强制置顶
```typescript
// useTimer 初始化时注入回调
const timer = useTimer({
  onWorkEnd: async () => {
    const win = getCurrentWindow()
    await win.setAlwaysOnTop(true)  // 强制窗口置顶
    await win.setFocus()            // 获取焦点
    // 播放提示音 + 发送通知
  },
  onBreakEnd: async () => {
    await getCurrentWindow().setAlwaysOnTop(false)  // 取消置顶
  }
})
```

### 托盘图标动态切换
```typescript
// App.vue 中监听状态变化
watch(() => [timer.mode.value, timer.isRunning.value], () => {
  let state = "idle"
  if (timer.mode.value === "work") {
    state = timer.isRunning.value ? "working" : "paused"
  } else if (timer.mode.value === "break") {
    state = "break"  // 休息时也使用 busy 图标
  }
  invoke("set_tray_icon", { state })  // 通知 Rust 更新托盘图标
}, { immediate: true })  // 立即执行确保初始状态正确
```

**Rust 侧图标路径解析** (lib.rs):
```rust
let icon_filename = match state {
  "working" | "break" => "power-tray-busy.png",
  "paused" => "power-tray-pause.png",
  _ => "power-tray-idle.png",
};

// 多路径回退策略 (解决开发/生产环境路径差异)
let possible_paths = vec![
  Some(PathBuf::from(format!("src-tauri/icons/{}", icon_filename))),  // 开发模式
  Some(PathBuf::from(format!("icons/{}", icon_filename))),             // 相对路径
];
if let Ok(resource_path) = app.path().resolve(...) {
  possible_paths.push(Some(resource_path));  // Tauri 资源路径 (生产模式)
}
```

**当前问题**: 开发模式下图标路径解析仍可能失败，需进一步调试路径逻辑。

### 音频播放模式
```typescript
// 直接使用 Web Audio API
const audio = new Audio("/notification-piano.mp3")  // public/ 目录下的文件
audio.play()

// 配置控制
if (settings.enableworkSound) {
  // 仅在用户启用时播放
}
```

**资源组织**:
- `public/notification-piano.mp3` - 工作结束提示音 (清脆钢琴声)
- `public/notification-chime.mp3` - 休息结束提示音 (柔和铃声)

### 系统通知权限请求
```typescript
import { isPermissionGranted, requestPermission, sendNotification } 
from "@tauri-apps/plugin-notification"

let permissionGranted = await isPermissionGranted()
if (!permissionGranted) {
  const permission = await requestPermission()
  permissionGranted = permission === "granted"
}

if (permissionGranted) {
  sendNotification({
    title: "休息时间到！",
    body: "工作辛苦了，起来活动一下吧！",
    sound: "default"  // 使用系统默认通知音
  })
}
```

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

### 添加新的 Tauri 插件
**完整流程** (以添加 `dialog` 插件为例):

1. **安装 Rust 依赖**
```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-dialog = "2"
```

2. **初始化插件**
```rust
// src-tauri/src/lib.rs setup()
.plugin(tauri_plugin_dialog::init())
```

3. **配置权限**
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "dialog:default"  // 添加此行
  ]
}
```

4. **安装 TS 类型定义**
```bash
pnpm add @tauri-apps/plugin-dialog
```

5. **前端调用**
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

### 4. localStorage 数据丢失
**原因**: Tauri 的 localStorage 绑定到特定的 AppHandle  
**解决**: 确保在 Vue 应用挂载后才读取 localStorage
```typescript
// ❌ 错误: 在模块顶层直接读取
const settings = JSON.parse(localStorage.getItem("key"))

// ✅ 正确: 在 onMounted 或 setup() 中读取
onMounted(() => {
  const settings = JSON.parse(localStorage.getItem("key"))
})
```

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
- [ ] 验证 localStorage 数据格式正确 (JSON 有效性)

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
