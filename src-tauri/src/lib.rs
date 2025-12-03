use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, image::Image, State,
};
use std::sync::Mutex;
use std::collections::HashMap;

mod db;
use db::{Database, TimerRecord};

// Icon cache wrapper - 存储 RGBA 原始数据
pub struct IconCache {
    icons: HashMap<String, (Vec<u8>, u32, u32)>, // (rgba_data, width, height)
}

impl IconCache {
    fn new() -> Self {
        IconCache {
            icons: HashMap::new(),
        }
    }
    
    fn get_icon<'a>(&'a self, key: &str) -> Option<Image<'a>> {
        self.icons.get(key).map(|(data, width, height)| {
            Image::new(data.as_slice(), *width, *height)
        })
    }
    
    fn insert(&mut self, key: String, data: Vec<u8>, width: u32, height: u32) {
        self.icons.insert(key, (data, width, height));
    }
}

// Database state wrapper
pub struct AppState {
    pub db: Mutex<Database>,
    pub current_user_id: Mutex<Option<i64>>,
    pub icon_cache: Mutex<IconCache>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ==================== Database Commands ====================

#[tauri::command]
fn db_init_user(device_id: String, state: State<AppState>) -> Result<db::User, String> {
    let db = state.db.lock().unwrap();
    let user = db.get_or_create_user(&device_id).map_err(|e| e.to_string())?;
    
    // 缓存当前用户 ID
    let mut current_user = state.current_user_id.lock().unwrap();
    *current_user = Some(user.id);
    
    Ok(user)
}

#[tauri::command]
fn db_update_phone(phone: Option<String>, state: State<AppState>) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.update_user_phone(user_id, phone).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_user(state: State<AppState>) -> Result<db::User, String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.get_user_by_id(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_settings(state: State<AppState>) -> Result<Vec<db::Setting>, String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.get_settings(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_setting(key: String, value: String, state: State<AppState>) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.save_setting(user_id, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_settings_batch(settings: Vec<(String, String)>, state: State<AppState>) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.save_settings_batch(user_id, settings).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_timer_records(limit: i64, state: State<AppState>) -> Result<Vec<TimerRecord>, String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.get_timer_records(user_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_add_timer_record(record: TimerRecord, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.add_timer_record(&record).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_update_timer_record(
    record_id: i64,
    updates: std::collections::HashMap<String, serde_json::Value>,
    state: State<AppState>
) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let name = updates.get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let category = updates.get("category")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let db = state.db.lock().unwrap();
    db.update_timer_record(user_id, record_id, name, category).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_delete_timer_record(record_id: String, state: State<AppState>) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.delete_timer_record(user_id, &record_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_clear_timer_records(state: State<AppState>) -> Result<(), String> {
    let user_id = state.current_user_id.lock().unwrap()
        .ok_or("User not initialized")?;
    
    let db = state.db.lock().unwrap();
    db.clear_timer_records(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, state: &str, app_state: State<AppState>) {
    if let Some(tray) = app.tray_by_id("tray") {
        // 更新提示文本
        let tooltip = match state {
            "working" => "LPE Reminder - 工作中",
            "paused" => "LPE Reminder - 已暂停",
            "break" => "LPE Reminder - 休息中",
            _ => "LPE Reminder - 空闲",
        };
        let _ = tray.set_tooltip(Some(tooltip));
        
        // 根据状态选择图标键
        let icon_key = match state {
            "working" | "break" => "busy",
            "paused" => "pause",
            _ => "idle",
        };
        
        // 从缓存中获取图标
        let cache = app_state.icon_cache.lock().unwrap();
        if let Some(icon) = cache.get_icon(icon_key) {
            match tray.set_icon(Some(icon)) {
                Ok(_) => {
                    println!("✓ Tray icon updated to '{}' (from cache)", state);
                }
                Err(e) => {
                    eprintln!("✗ Failed to set tray icon: {}", e);
                }
            }
        } else {
            eprintln!("✗ Icon '{}' not found in cache", icon_key);
        }
    }
}

#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, is_running: bool) {
    if let Some(_tray) = app.tray_by_id("tray") {
        // 根据运行状态动态更新菜单项的启用状态
        // 这里可以在未来扩展，比如禁用某些菜单项
        println!("Tray menu update requested, is_running: {}", is_running);
    }
}

#[tauri::command]
fn app_exit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn toggle_floating_window(app: tauri::AppHandle, show: bool) -> Result<(), String> {
    if let Some(float_window) = app.get_webview_window("float") {
        if show {
            float_window.show().map_err(|e| e.to_string())?;
        } else {
            float_window.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        Err("Float window not found".to_string())
    }
}

#[tauri::command]
fn show_tray_menu_at_cursor(app: tauri::AppHandle) -> Result<(), String> {
    // 获取托盘图标
    if let Some(_tray) = app.tray_by_id("tray") {
        // 作为替代方案，我们触发一个事件让前端响应
        app.emit("show-tray-menu-requested", ()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Tray not found".to_string())
    }
}

#[tauri::command]
fn resize_floating_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(float_window) = app.get_webview_window("float") {
        use tauri::Size;
        let size = Size::Logical(tauri::LogicalSize { width, height });
        float_window.set_size(size).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Float window not found".to_string())
    }
}

#[tauri::command]
fn move_floating_window(app: tauri::AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(float_window) = app.get_webview_window("float") {
        use tauri::Position;
        let position = Position::Logical(tauri::LogicalPosition { x, y });
        float_window.set_position(position).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Float window not found".to_string())
    }
}

#[tauri::command]
fn get_floating_window_position(app: tauri::AppHandle) -> Result<(f64, f64), String> {
    if let Some(float_window) = app.get_webview_window("float") {
        let position = float_window.outer_position().map_err(|e| e.to_string())?;
        let scale_factor = float_window.scale_factor().map_err(|e| e.to_string())?;
        let logical_pos = position.to_logical::<f64>(scale_factor);
        Ok((logical_pos.x, logical_pos.y))
    } else {
        Err("Float window not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 初始化数据库
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            
            // 开发环境和生产环境使用不同的数据库文件，避免数据冲突
            #[cfg(debug_assertions)]
            let db_filename = "lpe_reminder_dev.db";
            #[cfg(not(debug_assertions))]
            let db_filename = "lpe_reminder.db";

            let db_path = app_data_dir.join(db_filename);
            println!("Database path: {:?}", db_path);
            
            let database = Database::new(db_path).expect("Failed to initialize database");
            
            // 预加载托盘图标到缓存
            let mut icon_cache = IconCache::new();
            let icon_files = vec![
                ("idle", "power-tray-idle.png"),
                ("busy", "power-tray-busy.png"),
                ("pause", "power-tray-pause.png"),
            ];
            
            for (key, filename) in icon_files {
                // 构建候选路径
                let mut possible_paths = Vec::new();
                
                // 1. 当前工作目录/icons (Cargo 运行时 cwd 是 src-tauri/)
                if let Ok(current_dir) = std::env::current_dir() {
                    possible_paths.push(current_dir.join("icons").join(filename));
                    // 也尝试项目根目录 (如果 cwd 是项目根)
                    possible_paths.push(current_dir.join("src-tauri").join("icons").join(filename));
                }
                
                // 2. 可执行文件目录的相对路径
                if let Ok(exe_dir) = std::env::current_exe() {
                    if let Some(exe_parent) = exe_dir.parent() {
                        // target/debug/icons
                        possible_paths.push(exe_parent.join("icons").join(filename));
                        
                        // target/debug -> target -> src-tauri/icons
                        if let Some(target_dir) = exe_parent.parent() {
                            if let Some(src_tauri_dir) = target_dir.parent() {
                                possible_paths.push(src_tauri_dir.join("icons").join(filename));
                            }
                        }
                    }
                }
                
                // 3. Tauri 资源路径（生产模式）
                if let Ok(resource_path) = app.path().resolve(
                    format!("icons/{}", filename), 
                    tauri::path::BaseDirectory::Resource
                ) {
                    possible_paths.push(resource_path);
                }
                
                // 尝试加载图标
                let mut loaded = false;
                for icon_path in &possible_paths {
                    if icon_path.exists() {
                        match image::open(icon_path) {
                            Ok(img) => {
                                let rgba = img.to_rgba8();
                                let (width, height) = rgba.dimensions();
                                let raw_data = rgba.into_raw();
                                icon_cache.insert(key.to_string(), raw_data, width, height);
                                println!("✓ Preloaded icon '{}' from {:?}", key, icon_path);
                                loaded = true;
                                break;
                            }
                            Err(e) => {
                                eprintln!("  ✗ Failed to load image from {:?}: {}", icon_path, e);
                            }
                        }
                    }
                }
                
                if !loaded {
                    eprintln!("✗ Failed to preload icon '{}'. Tried {} paths:", key, possible_paths.len());
                    for (i, path) in possible_paths.iter().enumerate() {
                        eprintln!("  {}. {:?} (exists: {})", i + 1, path, path.exists());
                    }
                }
            }
            
            // 设置全局状态
            app.manage(AppState {
                db: Mutex::new(database),
                current_user_id: Mutex::new(None),
                icon_cache: Mutex::new(icon_cache),
            });
            
            println!("✓ Database and icon cache initialized successfully");
            

            // 创建托盘菜单项
            let start_i = MenuItem::with_id(app, "start", "开始", true, None::<&str>)?;
            let pause_i = MenuItem::with_id(app, "pause", "暂停", true, None::<&str>)?;
            let reset_i = MenuItem::with_id(app, "reset", "重置计时", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&start_i, &pause_i, &reset_i, &settings_i, &quit_i])?;

            // 创建托盘图标
            let _tray = TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("LPE Reminder - 空闲")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "start" => {
                        println!("Tray: Start clicked");
                        let _ = app.emit("tray-start", ());
                    }
                    "pause" => {
                        println!("Tray: Pause clicked");
                        let _ = app.emit("tray-pause", ());
                    }
                    "reset" => {
                        println!("Tray: Reset clicked");
                        let _ = app.emit("tray-reset", ());
                    }
                    "settings" => {
                        println!("Tray: Settings clicked");
                        let _ = app.emit("tray-settings", ());
                    }
                    "quit" => {
                        println!("Tray: Quit clicked");
                        let _ = app.emit("tray-quit", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        println!("Tray: Left click");
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            set_tray_icon, 
            update_tray_menu, 
            app_exit,
            toggle_floating_window,
            show_tray_menu_at_cursor,
            resize_floating_window,
            move_floating_window,
            get_floating_window_position,
            db_init_user,
            db_update_phone,
            db_get_user,
            db_get_settings,
            db_save_setting,
            db_save_settings_batch,
            db_get_timer_records,
            db_add_timer_record,
            db_update_timer_record,
            db_delete_timer_record,
            db_clear_timer_records
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
