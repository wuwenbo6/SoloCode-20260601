mod db;
mod scanner;
mod commands;

use std::sync::Mutex;
use tauri::Manager;
use crate::commands::{AppState, scan_folder, get_tracks, search_tracks, delete_tracks_by_prefix, get_track_count, update_track_tags, search_lyrics, download_lyrics};
use crate::db::MusicDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("music.db");
            let db = MusicDb::new(&db_path).expect("failed to initialize database");
            let state = AppState { db: Mutex::new(db) };
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![scan_folder, get_tracks, search_tracks, delete_tracks_by_prefix, get_track_count, update_track_tags, search_lyrics, download_lyrics])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
