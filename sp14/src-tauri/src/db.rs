use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Track {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub file_format: String,
}

pub struct MusicDb {
    conn: Connection,
}

impl MusicDb {
    pub fn new(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE NOT NULL, title TEXT NOT NULL, artist TEXT DEFAULT '', album TEXT DEFAULT '', duration_secs REAL DEFAULT 0, file_format TEXT DEFAULT '')",
            [],
        )?;
        Ok(MusicDb { conn })
    }

    pub fn insert_track(&self, track: &Track) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO tracks (id, path, title, artist, album, duration_secs, file_format) VALUES ((SELECT id FROM tracks WHERE path = ?1), ?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                track.path,
                track.title,
                track.artist,
                track.album,
                track.duration_secs,
                track.file_format,
            ],
        )?;
        Ok(())
    }

    pub fn get_all_tracks(&self) -> Result<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_secs, file_format FROM tracks ORDER BY title",
        )?;
        let tracks = stmt
            .query_map([], |row| {
                Ok(Track {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration_secs: row.get(5)?,
                    file_format: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(tracks)
    }

    pub fn search_tracks(&self, query: &str) -> Result<Vec<Track>> {
        let pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, artist, album, duration_secs, file_format FROM tracks WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 ORDER BY title",
        )?;
        let tracks = stmt
            .query_map(params![pattern], |row| {
                Ok(Track {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    duration_secs: row.get(5)?,
                    file_format: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(tracks)
    }

    pub fn delete_by_path_prefix(&self, prefix: &str) -> Result<usize> {
        let count = self.conn.execute(
            "DELETE FROM tracks WHERE path LIKE ?1",
            params![format!("{}%", prefix)],
        )?;
        Ok(count)
    }

    pub fn track_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))?;
        Ok(count)
    }

    pub fn update_track_tags(&self, path: &str, title: &str, artist: &str, album: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE tracks SET title = ?1, artist = ?2, album = ?3 WHERE path = ?4",
            params![title, artist, album, path],
        )?;
        Ok(())
    }
}
