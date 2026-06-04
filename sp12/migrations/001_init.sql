CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    fps INTEGER NOT NULL CHECK (fps BETWEEN 1 AND 30),
    resolution TEXT NOT NULL CHECK (resolution IN ('original', '480p', '720p')),
    quality TEXT NOT NULL CHECK (quality IN ('high', 'low')),
    video_duration REAL NOT NULL,
    video_width INTEGER NOT NULL,
    video_height INTEGER NOT NULL,
    video_codec TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    output_filename TEXT,
    output_size INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
