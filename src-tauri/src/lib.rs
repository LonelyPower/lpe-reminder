use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
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
        
        // TODO: 如果有不同状态的图标文件，可以在这里切换
        // 目前先使用同一个图标，通过 tooltip 区分状态
        // 可以后续添加 idle.png, working.png, paused.png, break.png
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
            let quit_i = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&start_i, &pause_i, &reset_i, &quit_i])?;

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
