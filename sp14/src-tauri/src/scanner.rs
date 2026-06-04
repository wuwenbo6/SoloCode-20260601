use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::read_from;
use lofty::tag::Accessor;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ScannedTrack {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub file_format: String,
}

const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav"];

fn is_supported_extension(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

fn collect_audio_files(dir: &Path) -> Vec<PathBuf> {
    WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(is_supported_extension)
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect()
}

fn extract_track(file_path: &Path) -> Option<ScannedTrack> {
    let mut file = File::open(file_path).ok()?;
    let tagged_file = read_from(&mut file).ok()?;
    let ext = file_path.extension()?.to_str()?.to_string();
    let file_format = ext.to_lowercase();

    let file_name = file_path.file_stem()?.to_str()?.to_string();

    let (title, artist, album) = match tagged_file.primary_tag() {
        Some(tag) => {
            let title = tag.title().map(|s| s.to_string()).unwrap_or(file_name);
            let artist = tag
                .artist()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string());
            let album = tag
                .album()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Album".to_string());
            (title, artist, album)
        }
        None => (
            file_name,
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
        ),
    };

    let duration_secs = tagged_file.properties().duration().as_secs_f64();

    Some(ScannedTrack {
        path: file_path.to_str()?.to_string(),
        title,
        artist,
        album,
        duration_secs,
        file_format,
    })
}

pub fn scan_directory_simple(dir: &Path) -> Vec<ScannedTrack> {
    let files = collect_audio_files(dir);
    files
        .par_iter()
        .filter_map(|path| extract_track(path))
        .collect()
}
