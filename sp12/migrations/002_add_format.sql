ALTER TABLE tasks ADD COLUMN format TEXT NOT NULL DEFAULT 'mp4' CHECK (format IN ('mp4', 'gif', 'webp'));
