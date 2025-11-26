use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, image::Image,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, state: &str) {
    if let Some(tray) = app.tray_by_id("tray") {
        // 更新提示文本
        let tooltip = match state {
            "working" => "LPE Reminder - 工作中",
            "paused" => "LPE Reminder - 已暂停",
            "break" => "LPE Reminder - 休息中",
            _ => "LPE Reminder - 空闲",
        };
        let _ = tray.set_tooltip(Some(tooltip));
        
        // 根据状态切换图标
        let icon_filename = match state {
            "working" | "break" => "power-tray-busy.png",
            "paused" => "power-tray-pause.png",
            _ => "power-tray-idle.png",
        };
        
        // 尝试从多个可能的路径加载图标
        let mut possible_paths = vec![
            // 开发模式：src-tauri/icons/
            Some(std::path::PathBuf::from(format!("src-tauri/icons/{}", icon_filename))),
            // 相对于当前目录
            Some(std::path::PathBuf::from(format!("icons/{}", icon_filename))),
        ];
        
        // 添加 Tauri 资源路径
        if let Ok(resource_path) = app.path().resolve(format!("icons/{}", icon_filename), tauri::path::BaseDirectory::Resource) {
            possible_paths.push(Some(resource_path));
        }
        
        let mut icon_loaded = false;
        for path_option in possible_paths {
            if let Some(icon_path) = path_option {
                if icon_path.exists() {
                    match image::open(&icon_path) {
                        Ok(img) => {
                            let rgba = img.to_rgba8();
                            let (width, height) = rgba.dimensions();
                            let raw_data = rgba.into_raw();
                            let icon = Image::new(&raw_data, width, height);
                            
                            if let Err(e) = tray.set_icon(Some(icon)) {
                                eprintln!("Failed to set tray icon: {}", e);
                            } else {
                                println!("Tray icon updated to: {} from {:?}", state, icon_path);
                                icon_loaded = true;
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to load icon from {:?}: {}", icon_path, e);
                        }
                    }
                }
            }
        }
        
        if !icon_loaded {
            eprintln!("Could not find icon file: {}", icon_filename);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 创建托盘菜单项
            let start_i = MenuItem::with_id(app, "start", "开始工作", true, None::<&str>)?;
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
                        app.exit(0);
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
        .invoke_handler(tauri::generate_handler![greet, set_tray_icon, update_tray_menu, app_exit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
