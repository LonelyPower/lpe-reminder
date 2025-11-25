# LPE Reminder - AI Coding Instructions

## Project Context
- **Framework**: Tauri v2 (Rust backend) + Vue 3 (Frontend) + Vite.
- **Languages**: TypeScript (Frontend), Rust (Backend).
- **Package Manager**: `pnpm`.
- **Target Platforms**: Desktop (Windows/macOS/Linux) and Mobile (Android).

## Architecture & Patterns
- **Frontend Architecture**:
  - Uses Vue 3 Composition API with `<script setup>`.
  - **State Management**: Logic is decoupled from UI components. See `src/composables/useTimer.ts` for the core timer state machine (idle/work/break).
  - **Components**: Located in `src/components/`. `TimerPanel.vue` handles the main display, `BreakOverlay.vue` for full-screen interruptions.
- **Backend Architecture**:
  - Rust code in `src-tauri/src/`.
  - `lib.rs` is the main entry point for Tauri commands and setup.
  - Communication via Tauri Commands (`invoke`).
- **Timer Logic**:
  - Implemented in `useTimer.ts` using `setInterval` and delta time calculation to prevent drift.
  - State: `mode` (idle/work/break), `remainingMs`, `cycleCount`.

## Critical Workflows
- **Development**:
  - Run app: `pnpm tauri dev` (starts both Rust and Vite servers).
  - **Do not** run `pnpm dev` alone for app development; it lacks the Tauri context.
- **Build**:
  - Desktop: `pnpm tauri build`.
  - Android: `pnpm tauri android build` (requires Android Studio/SDK setup).
- **Dependency Management**:
  - Always use `pnpm install/add`.

## Project-Specific Conventions
- **Timer State**: When modifying timer logic, edit `src/composables/useTimer.ts` first. The UI should purely react to this state.
- **Tauri Configuration**:
  - `src-tauri/tauri.conf.json` controls window settings, permissions, and build scripts.
  - Note the `beforeDevCommand` and `beforeBuildCommand` hooks.
- **Rust/Frontend Bridge**:
  - Define commands in `src-tauri/src/lib.rs` with `#[tauri::command]`.
  - Register handlers in the `tauri::Builder` chain.

## Key Files
- `src/composables/useTimer.ts`: Core business logic.
- `src-tauri/tauri.conf.json`: App configuration.
- `src-tauri/src/lib.rs`: Rust backend logic.
- `src/App.vue`: Main layout and component composition.
