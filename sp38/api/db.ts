import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'access-control.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS doors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online', 'offline'))
  );
  CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    key_id TEXT REFERENCES keys(id),
    door_id TEXT NOT NULL REFERENCES doors(id),
    method TEXT NOT NULL CHECK(method IN ('webauthn', 'nfc', 'remote', 'visitor')),
    latitude REAL,
    longitude REAL,
    success INTEGER NOT NULL DEFAULT 0,
    operator_type TEXT NOT NULL CHECK(operator_type IN ('user', 'admin', 'visitor')),
    operator_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS visitor_keys (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    visitor_name TEXT NOT NULL DEFAULT '',
    door_id TEXT NOT NULL REFERENCES doors(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'revoked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS door_schedules (
    id TEXT PRIMARY KEY,
    door_id TEXT NOT NULL REFERENCES doors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS door_keys (
    door_id TEXT NOT NULL REFERENCES doors(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    granted_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (door_id, key_id)
  );
  CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_access_logs_door_id ON access_logs(door_id);
  CREATE INDEX IF NOT EXISTS idx_keys_user_id ON keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_keys_credential_id ON keys(credential_id);
  CREATE INDEX IF NOT EXISTS idx_visitor_keys_code ON visitor_keys(code);
  CREATE INDEX IF NOT EXISTS idx_visitor_keys_door_id ON visitor_keys(door_id);
  CREATE INDEX IF NOT EXISTS idx_visitor_keys_status ON visitor_keys(status);
  CREATE INDEX IF NOT EXISTS idx_door_schedules_door_id ON door_schedules(door_id);
`)

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (id, username, display_name, role) VALUES (?, ?, ?, ?)'
)
const insertDoor = db.prepare(
  'INSERT OR IGNORE INTO doors (id, name, location, status) VALUES (?, ?, ?, ?)'
)
const insertSchedule = db.prepare(
  'INSERT OR IGNORE INTO door_schedules (id, door_id, day_of_week, start_time, end_time, enabled) VALUES (?, ?, ?, ?, ?, ?)'
)

const seedUsers = [
  ['admin-001', 'admin', '系统管理员', 'admin'],
  ['user-001', 'zhangsan', '张三', 'user'],
  ['user-002', 'lisi', '李四', 'user'],
]

const seedDoors = [
  ['door-001', 'A栋大门', 'A栋入口', 'online'],
  ['door-002', 'B栋后门', 'B栋后侧', 'online'],
  ['door-003', '机房门', '机房区域', 'online'],
]

const seedSchedules: string[][] = []
let schedIdx = 0
for (const door of seedDoors) {
  for (let day = 1; day <= 5; day++) {
    schedIdx++
    seedSchedules.push([`sched-${String(schedIdx).padStart(3, '0')}`, door[0], String(day), '09:00', '18:00', '1'])
  }
}

const transaction = db.transaction(() => {
  for (const user of seedUsers) {
    insertUser.run(...user)
  }
  for (const door of seedDoors) {
    insertDoor.run(...door)
  }
  for (const sched of seedSchedules) {
    insertSchedule.run(...sched)
  }
})

transaction()

export default db
