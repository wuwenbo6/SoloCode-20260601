use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, State};

use crate::db::{MusicDb, Track};
use crate::scanner;

pub struct AppState {
    pub db: Mutex<MusicDb>,
}

#[derive(serde::Serialize, Clone)]
pub struct ScanProgressEvent {
    pub total: usize,
    pub processed: usize,
    pub batch: Vec<Track>,
}

#[tauri::command]
pub async fn scan_folder<R: tauri::Runtime>(
    state: State<'_, AppState>,
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<(), String> {
    let dir = PathBuf::from(path);

    let scanned = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_directory_simple(&dir)
    })
    .await
    .map_err(|e| e.to_string())?;

    let batch_size = 100;
    let total = scanned.len();

    for (i, chunk) in scanned.chunks(batch_size).enumerate() {
        let mut batch_tracks = Vec::with_capacity(chunk.len());

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            for st in chunk {
                let track = Track {
                    id: 0,
                    path: st.path.clone(),
                    title: st.title.clone(),
                    artist: st.artist.clone(),
                    album: st.album.clone(),
                    duration_secs: st.duration_secs,
                    file_format: st.file_format.clone(),
                };
                db.insert_track(&track).map_err(|e| e.to_string())?;
                batch_tracks.push(track);
            }
        }

        let processed = (i + 1) * batch_size;
        let processed = processed.min(total);

        app.emit(
            "scan_progress",
            ScanProgressEvent {
                total,
                processed,
                batch: batch_tracks,
            },
        )
        .map_err(|e| e.to_string())?;

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }

    Ok(())
}

#[tauri::command]
pub fn get_tracks(state: State<AppState>) -> Result<Vec<Track>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_tracks().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_tracks(state: State<AppState>, query: String) -> Result<Vec<Track>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_tracks(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tracks_by_prefix(state: State<AppState>, prefix: String) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_by_path_prefix(&prefix).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_track_count(state: State<AppState>) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.track_count().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_track_tags(
    state: State<'_, AppState>,
    path: String,
    title: String,
    artist: String,
    album: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let title_clone = title.clone();
    let artist_clone = artist.clone();
    let album_clone = album.clone();

    tauri::async_runtime::spawn_blocking(move || {
        use lofty::file::{AudioFile, TaggedFileExt};
        use lofty::tag::Accessor;
        use lofty::config::WriteOptions;

        let mut file = std::fs::File::options()
            .read(true)
            .write(true)
            .open(&file_path)
            .map_err(|e| e.to_string())?;

        let mut tagged_file = lofty::probe::read_from(&mut file)
            .map_err(|e| e.to_string())?;

        if let Some(tag) = tagged_file.primary_tag_mut() {
            tag.set_title(String::from(&title_clone));
            tag.set_artist(String::from(&artist_clone));
            tag.set_album(String::from(&album_clone));
        } else {
            let tag = lofty::tag::Tag::new(lofty::tag::TagType::Id3v2);
            tagged_file.insert_tag(tag);
            if let Some(tag) = tagged_file.primary_tag_mut() {
                tag.set_title(String::from(&title_clone));
                tag.set_artist(String::from(&artist_clone));
                tag.set_album(String::from(&album_clone));
            }
        }

        tagged_file.save_to_path(&file_path, WriteOptions::default())
            .map_err(|e| e.to_string())?;

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())??;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_track_tags(&path, &title, &artist, &album)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct LrcSearchResult {
    pub id: i64,
    pub title: String,
    pub artist: String,
}

#[derive(serde::Deserialize)]
struct NeteaseSearchResponse {
    result: Option<NeteaseSearchResult>,
}

#[derive(serde::Deserialize)]
struct NeteaseSearchResult {
    songs: Option<Vec<NeteaseSong>>,
}

#[derive(serde::Deserialize)]
struct NeteaseSong {
    id: i64,
    name: String,
    artists: Vec<NeteaseArtist>,
}

#[derive(serde::Deserialize)]
struct NeteaseArtist {
    name: String,
}

#[derive(serde::Deserialize)]
struct NeteaseLrcResponse {
    lrc: Option<NeteaseLrcContent>,
}

#[derive(serde::Deserialize)]
struct NeteaseLrcContent {
    lyric: Option<String>,
}

#[tauri::command]
pub async fn search_lyrics(
    title: String,
    artist: String,
) -> Result<Vec<LrcSearchResult>, String> {
    let query = format!("{} {}", title, artist);
    let url = format!(
        "https://music.163.com/api/search/get/web?s={}&type=1&limit=10",
        urlencoding::encode(&query)
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Referer", "https://music.163.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = resp.json::<NeteaseSearchResponse>().await.map_err(|e| e.to_string())?;

    let results = body
        .result
        .and_then(|r| r.songs)
        .unwrap_or_default()
        .into_iter()
        .map(|song| LrcSearchResult {
            id: song.id,
            title: song.name,
            artist: song.artists.iter().map(|a| a.name.clone()).collect::<Vec<_>>().join("/"),
        })
        .collect();

    Ok(results)
}

#[tauri::command]
pub async fn download_lyrics(
    song_id: i64,
    save_path: String,
) -> Result<String, String> {
    let url = format!(
        "https://music.163.com/api/song/lyric?id={}&lv=1",
        song_id
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Referer", "https://music.163.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = resp.json::<NeteaseLrcResponse>().await.map_err(|e| e.to_string())?;

    let lrc_content = body
        .lrc
        .and_then(|l| l.lyric)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "No lyrics found".to_string())?;

    fs::write(&save_path, &lrc_content).map_err(|e| e.to_string())?;

    Ok(lrc_content)
}
