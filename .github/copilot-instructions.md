# LPE Reminder - AI Coding Guide

## Architecture Overview

This is a **Tauri v2 + Vue 3** desktop app for work/break reminders with a strict architectural pattern:

- **Frontend (Vue 3 + TypeScript)**: UI, reactive state, composables for business logic
- **Backend (Rust + Tauri)**: System integration, SQLite database, window management, tray icons
- **Communication**: All database operations go through `invoke()` to Rust commands (never direct DB access from frontend)

### Key Components

1. **Dual Window System** (`tauri.conf.json`):
   - `main`: Primary UI window (Timer, Statistics, Settings)
   - `float`: Always-on-top floating timer (`float-window.html`, separate entry point)
   
2. **Dual Timer Modes**:
   - **Countdown**: Pomodoro-style work/break cycles (handled by `useTimer.ts`)
   - **Stopwatch**: Duration-based work tracking with threshold-based breaks (handled by `useStopwatch.ts`)

3. **Database Architecture** (CRITICAL):
   - Frontend NEVER touches SQLite directly
   - All DB ops go through `src/utils/database.ts` → `invoke("db_*")` → `src-tauri/src/db.rs`
   - User initialization pattern: `initDatabase()` → `db_init_user` → stores `current_user_id` in Rust state

## File Organization Conventions

### Component Naming (Prefix-Based)
- `Page_*.vue`: Full-page views (Timer, Statistics, Stopwatch)
- `Dialog_*.vue`: Modal overlays (Settings, Break, CloseConfirm)
- `Section_*.vue`: Reusable page sections (CategorySelector, UserInfo)
- `Dialog_Base.vue`: Base dialog wrapper component (use for new dialogs)

### Composable Patterns (`src/composables/`)
Each composable is a single-responsibility function returning reactive state + methods:
```typescript
export function useFeature(deps) {
  const state = ref(...);
  function action() { ... }
  return { state, action };
}
```

Key composables:
- `useTimer.ts` / `useStopwatch.ts`: Core timer state machines (platform-agnostic)
- `useSettingsDB.ts`: Settings with auto-save to SQLite
- `useTimerHistoryDB.ts`: Work/break record management
- `useFloatingWindow.ts`: Sync state between main/float windows via events
- `useTraySync.ts`: Bidirectional tray menu integration

### Utility Functions (`src/utils/`)
- `database.ts`: **Only place for `invoke("db_*")` calls** - all DB commands here
- `errorHandler.ts`: Use `safeInvoke()` for Rust commands, `safeExecute()` for async ops
- `timeUtils.ts`: Duration parsing/formatting helpers

## Development Workflows

### Running the App
```powershell
pnpm tauri dev  # Starts Vite dev server + Tauri window
```
- Frontend hot-reloads automatically
- Rust changes require manual rebuild (rerun command)

### Building for Production
```powershell
pnpm tauri build  # Creates installer in src-tauri/target/release/bundle/
```

### Adding a New Database Table
1. Add schema in `src-tauri/src/db.rs::init_tables()`
2. Create struct with `#[derive(Serialize, Deserialize)]`
3. Add CRUD methods to `impl Database`
4. Expose via `#[tauri::command]` in `src-tauri/src/lib.rs`
5. Add TypeScript interface and wrapper in `src/utils/database.ts`

### Adding a New Setting
1. Add field to `AppSettings` interface in `src/composables/useSettingsDB.ts`
2. Add default value in `defaultSettings`
3. No Rust changes needed (settings stored as key-value pairs)

## Critical Patterns

### Event-Based Window Communication
Main ↔ Float window sync uses `emit()`/`listen()`:
```typescript
// Main window sends state
await getCurrentWindow().emit("timer-state-sync", { mode, remainingMs, ... });

// Float window receives
await listen("timer-state-sync", (event) => { ... });
```

### Tray Icon Dynamic Updates
System tray changes icon based on state (working/paused/break) using in-memory cache:
- Icons generated dynamically in Rust (`generate_tray_icon()` in `lib.rs`)
- Cached in `AppState::icon_cache` to avoid regeneration overhead
- Updated via `update_tray_icon_state()` command from frontend

### Multi-Entry Build (Vite)
`vite.config.ts` defines two entry points:
- `index.html` → main window
- `float-window.html` → floating window

Both share components but have different entry scripts (`main.ts` vs `float-main.ts`)

### Error Handling Convention
Always use wrappers from `errorHandler.ts`:
```typescript
const result = await safeInvoke<DataType>("rust_command", { args });
if (!result) return; // Command failed, already logged
```

### Composable Lifecycle in App.vue
`App.vue` orchestrates all composables in this order:
1. Initialize settings from DB (`initSettings()`)
2. Create timer/stopwatch with settings
3. Set up cross-composable callbacks (`setupTimerCallbacks()`)
4. Register event listeners (tray, float, close)
5. Apply theme and restore window position

## Common Tasks

### Adding a New Tauri Command
```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn my_command(arg: String, state: State<AppState>) -> Result<ReturnType, String> {
    // Implementation
}

// Register in run():
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![my_command, ...])
```

### Creating a New Dialog
1. Copy `Dialog_Base.vue` structure
2. Use `<Dialog_Base :visible="show" @close="...">` wrapper
3. Name as `Dialog_YourFeature.vue`
4. Add `showYourFeature` ref in `App.vue`

### Adding Audio Notification
1. Place audio file in `public/` directory
2. Import and play via `src/utils/audioPlayer.ts::playSound()`
3. Check `settings.enableworkSound` / `settings.enablerestSound` before playing

## Technical Constraints

- **No direct SQLite from frontend**: Always route through Rust commands
- **User ID pattern**: Store in `AppState::current_user_id` after `db_init_user`
- **Window visibility**: Both windows start invisible, shown programmatically
- **Float window**: Always-on-top, no decorations, separate HTML entry
- **Theme system**: CSS variables in `assets/theme.css`, switched by class on `<html>`

## Testing Patterns

- Database: Test via `pnpm tauri dev` console logs (frontend has `console.log` for DB calls)
- Tray: Check tray icon changes in system taskbar
- Float sync: Open both windows and verify state synchronization
- Break mode: Test full-screen overlay behavior (hard to exit = intended)
