# LPE Reminder - AI Coding Instructions

## Project Overview
A cross-platform eye care timer app built with **Tauri v2** (Rust) + **Vue 3** (TypeScript) + **Vite**.  
Uses **pnpm** exclusively. Targets: Desktop (Windows/macOS/Linux) and Mobile (Android).

## Architecture Patterns

### State Management Philosophy
**Strict separation**: Business logic lives in composables, UI components are purely reactive consumers.
- `src/composables/useTimer.ts`: State machine (idle → work → break) with drift-free timing using `setInterval` + delta time calculation
- `src/composables/useSettings.ts`: Reactive settings with automatic `localStorage` persistence via Vue `watch()`
- Components (`TimerPanel.vue`, `BreakOverlay.vue`) receive state via props, emit events only

### Frontend-Backend Bridge
**Tauri Commands** (Rust → TS):
```rust
// Define in src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String { ... }

// Register in .invoke_handler()
.invoke_handler(tauri::generate_handler![greet, set_tray_icon, app_exit])
```
```ts
// Call from Vue
import { invoke } from "@tauri-apps/api/core";
await invoke("set_tray_icon", { state: "working" });
```

**Event Emission** (Rust → TS):
```rust
// Emit from menu/tray handlers
app.emit("tray-start", ()).unwrap();
```
```ts
// Listen in App.vue onMounted
await listen("tray-start", () => timer.start());
```

### System Tray Integration
Implemented in `lib.rs` `setup()` hook:
- Menu items (`MenuItem::with_id`) trigger events via `.on_menu_event()`
- Left-click tray icon shows/focuses main window (`.on_tray_icon_event()`)
- Tooltip updated via `set_tray_icon` command (TODO: dynamic icon switching)

### Window Lifecycle
- **Close behavior**: Configurable in settings (`ask`/`minimize`/`quit`)
- Handled via `getCurrentWindow().onCloseRequested()` in `App.vue`
- Break mode: Window forced always-on-top (`setAlwaysOnTop(true)`) + full-screen overlay

## Critical Workflows

### Development
```bash
pnpm tauri dev  # ALWAYS use this (starts Vite + Rust in Tauri context)
# NEVER: pnpm dev (missing Tauri APIs)
```
- Vite runs on port `1420` (fixed, see `vite.config.ts`)
- Hot reload works for Vue; Rust changes require restart

### Build
```bash
pnpm tauri build          # Desktop (outputs to src-tauri/target/release)
pnpm tauri android build  # Mobile (requires Android SDK)
```

### Adding Tauri Plugins
1. Add Rust dependency: Edit `src-tauri/Cargo.toml`
2. Initialize in `lib.rs`: `.plugin(tauri_plugin_xxx::init())`
3. Grant permissions: Update `src-tauri/capabilities/default.json`
4. Install TS types: `pnpm add @tauri-apps/plugin-xxx`

Example (notification plugin already added):
```json
// capabilities/default.json
"permissions": ["notification:default"]
```

## Project-Specific Conventions

### Timer State Modification
1. **Edit logic first**: `src/composables/useTimer.ts` (single source of truth)
2. **Reactive updates**: Components auto-reflect state changes
3. **Duration updates**: Use `updateDurations()` method (see `App.vue` watch example)

### Settings Persistence
- **Automatic**: Any change to `settings` object triggers `localStorage` save
- **Schema**: Update `AppSettings` interface in `useSettings.ts`
- **Reset**: Call `resetToDefault()` to revert

### Audio/Notification Patterns
See `App.vue` callbacks:
```ts
onWorkEnd: async () => {
  // 1. Force window top + focus
  await getCurrentWindow().setAlwaysOnTop(true);
  // 2. Play audio (files in public/)
  const audio = new Audio("/notification-piano.mp3");
  audio.play();
  // 3. Request permission + send notification
  if (await isPermissionGranted()) {
    sendNotification({ title: "...", body: "..." });
  }
}
```

### Component Structure
- **Props-down, Events-up**: No direct state mutation in child components
- **Teleport for overlays**: `BreakOverlay.vue` uses `<teleport to="body">` for z-index isolation
- **Scoped styles**: All components use `<style scoped>`

## Key Files & Their Roles
- `src/composables/useTimer.ts` - Core timer FSM + drift-free interval logic
- `src/composables/useSettings.ts` - Reactive config with auto-persistence
- `src/App.vue` - Lifecycle orchestrator (tray listeners, window events, audio/notification)
- `src-tauri/src/lib.rs` - Tauri setup (plugins, commands, tray, menu)
- `src-tauri/tauri.conf.json` - App metadata, build hooks, window config
- `src-tauri/capabilities/default.json` - Security permissions manifest
- `vite.config.ts` - Fixed port (1420) + dev server config for Tauri
