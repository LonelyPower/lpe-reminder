# LPE Reminder (护眼定时器)

> 一个基于 Tauri v2 + Vue 3 构建的现代化跨平台护眼提醒工具。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)
![Vue](https://img.shields.io/badge/Vue-3.5-green.svg)
![Rust](https://img.shields.io/badge/Rust-1.70+-brown.svg)

## 📖 项目简介

LPE Reminder 是一款专为长时间使用电脑的人群设计的护眼工具。它通过强制休息、定时提醒等方式，帮助用户养成良好的用眼习惯。项目采用前后端分离架构，前端使用 Vue 3 提供流畅的 UI 体验，后端使用 Rust (Tauri) 提供高性能的系统级能力和数据持久化。

## ✨ 核心功能

- **双重计时模式**
  - **倒计时模式 (番茄钟)**: 经典的工作/休息循环，适合专注工作。
  - **正计时模式**: 记录工作时长，并在达到设定阈值时提醒休息。

- **强力休息提醒**
  - **全屏遮罩**: 休息时间强制全屏遮挡，防止继续工作。
  - **窗口置顶**: 休息期间窗口强制置顶，无法被覆盖。
  - **系统通知**: 工作/休息结束时发送系统通知。
  - **声音提醒**: 内置清脆的钢琴音和柔和的铃声提示。

- **悬浮窗体验**
  - **迷你计时器**: 桌面悬浮小窗，实时显示剩余时间/状态。
  - **双向同步**: 悬浮窗与主窗口状态实时同步。
  - **智能显隐**: 可配置显示内容和尺寸。

- **系统托盘集成**
  - **动态图标**: 根据工作、休息、暂停状态实时切换托盘图标。
  - **快捷菜单**: 支持从托盘快速开始、暂停、重置或退出。
  - **高性能缓存**: 采用内存缓存技术，图标切换零延迟。

- **数据持久化 (SQLite)**
  - **Rust 原生管理**: 数据库由 Rust 后端直接管理，安全高效。
  - **自动迁移**: 首次运行自动将旧版 localStorage 数据迁移至 SQLite。
  - **历史统计**: 记录每一次工作和休息，提供今日/本周数据统计。

## 🛠️ 技术栈

### 前端 (Frontend)
- **框架**: Vue 3.5 (Composition API)
- **语言**: TypeScript 5.6
- **构建工具**: Vite 6.0
- **样式**: CSS Modules / Scoped CSS

### 后端 (Backend)
- **框架**: Tauri v2.0
- **语言**: Rust (Edition 2021)
- **数据库**: SQLite (via `rusqlite`)
- **图片处理**: `image` crate (用于动态图标生成)

### 架构设计
本项目采用 **Rust 主导的数据库架构**：
- 前端 **不直接操作** 数据库，而是通过 Tauri Commands 调用 Rust API。
- Rust 后端负责所有数据库连接、查询、写入和事务管理。
- 数据库文件存储在系统标准的 AppData 目录下，确保数据持久性。

## 🚀 快速开始

### 环境要求
- **Node.js**: v18+
- **包管理器**: pnpm (推荐)
- **Rust**: 最新稳定版 (需安装 C++ 构建工具)

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# Rust 依赖会在首次运行时自动下载
```

### 开发模式

```bash
# 启动开发服务器 (同时启动前端和 Tauri 后端)
pnpm tauri dev
```

### 打包构建

```bash
# 构建生产版本
pnpm tauri build
```

## 📂 目录结构

```
lpe-reminder/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件 (TimerPanel, SettingsDialog 等)
│   ├── composables/        # 组合式函数 (useTimer, useSettingsDB 等)
│   ├── utils/              # 工具函数 (database.ts API 封装)
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── src-tauri/              # Rust 后端源码
│   ├── src/
│   │   ├── db.rs           # 数据库模块 (ORM, CRUD)
│   │   ├── lib.rs          # Tauri 命令与应用入口
│   │   └── main.rs         # 二进制入口
│   ├── icons/              # 应用图标资源
│   ├── capabilities/       # 权限配置
│   └── tauri.conf.json     # Tauri 配置文件
├── public/                 # 静态资源 (音频文件)
└── README.md               # 项目文档
```

## 📝 许可证

MIT License
