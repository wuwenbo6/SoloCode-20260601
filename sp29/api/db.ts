import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'positioning.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    floor_number INTEGER NOT NULL UNIQUE,
    width REAL NOT NULL DEFAULT 600,
    height REAL NOT NULL DEFAULT 500,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS beacons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1,
    tx_power REAL NOT NULL DEFAULT -59,
    path_loss_exp REAL NOT NULL DEFAULT 2.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS path_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1,
    blocked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS path_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node_id INTEGER NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
    to_node_id INTEGER NOT NULL REFERENCES path_nodes(id) ON DELETE CASCADE,
    weight REAL NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0,
    UNIQUE(from_node_id, to_node_id)
  );

  CREATE TABLE IF NOT EXISTS obstacles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1
  );
`);

const floorCount = (db.prepare('SELECT COUNT(*) as count FROM floors').get() as {count: number}).count;
if (floorCount === 0) {
  const insertFloor = db.prepare('INSERT INTO floors (name, floor_number) VALUES (?, ?)');
  insertFloor.run('一楼大厅', 1);
  insertFloor.run('二楼展厅', 2);

  const insertBeacon = db.prepare('INSERT INTO beacons (uuid, name, x, y, floor) VALUES (?, ?, ?, ?, ?)');
  insertBeacon.run('AA-BB-CC-DD-EE-01', '一楼A-入口', 100, 100, 1);
  insertBeacon.run('AA-BB-CC-DD-EE-02', '一楼B-中庭', 500, 100, 1);
  insertBeacon.run('AA-BB-CC-DD-EE-03', '一楼C-展厅', 300, 400, 1);
  insertBeacon.run('AA-BB-CC-DD-EE-04', '二楼A-电梯口', 100, 150, 2);
  insertBeacon.run('AA-BB-CC-DD-EE-05', '二楼B-展品区', 400, 150, 2);
  insertBeacon.run('AA-BB-CC-DD-EE-06', '二楼C-贵宾室', 300, 350, 2);

  const insertNode = db.prepare('INSERT INTO path_nodes (name, x, y, floor) VALUES (?, ?, ?, ?)');
  insertNode.run('一楼入口', 100, 100, 1);
  insertNode.run('一楼大厅', 300, 100, 1);
  insertNode.run('一楼中庭', 500, 100, 1);
  insertNode.run('一楼展厅A', 200, 250, 1);
  insertNode.run('一楼展厅B', 400, 250, 1);
  insertNode.run('一楼展厅C', 300, 400, 1);
  insertNode.run('一楼休息区', 500, 400, 1);
  insertNode.run('二楼电梯口', 100, 150, 2);
  insertNode.run('二楼走廊', 250, 150, 2);
  insertNode.run('二楼展品区', 400, 150, 2);
  insertNode.run('二楼会议室', 400, 350, 2);
  insertNode.run('二楼贵宾室', 250, 350, 2);

  const insertEdge = db.prepare('INSERT INTO path_edges (from_node_id, to_node_id, weight) VALUES (?, ?, ?)');
  insertEdge.run(1, 2, 200);
  insertEdge.run(2, 3, 200);
  insertEdge.run(2, 4, 180);
  insertEdge.run(2, 5, 180);
  insertEdge.run(4, 5, 200);
  insertEdge.run(4, 6, 200);
  insertEdge.run(5, 6, 180);
  insertEdge.run(5, 7, 200);
  insertEdge.run(6, 7, 200);
  insertEdge.run(8, 9, 150);
  insertEdge.run(9, 10, 150);
  insertEdge.run(10, 11, 200);
  insertEdge.run(9, 12, 220);
  insertEdge.run(11, 12, 150);

  const insertObstacle = db.prepare('INSERT INTO obstacles (x, y, width, height, floor) VALUES (?, ?, ?, ?, ?)');
  insertObstacle.run(200, 180, 60, 40, 1);
  insertObstacle.run(380, 330, 40, 60, 1);
  insertObstacle.run(150, 220, 50, 80, 2);
  insertObstacle.run(330, 250, 40, 50, 2);
}

export default db;
