// 数据库层：Node 22 内置 node:sqlite（零依赖）
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  pass       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  owner_id   INTEGER NOT NULL,
  event      TEXT NOT NULL,
  title      TEXT DEFAULT '',
  query      TEXT DEFAULT '',
  school     TEXT DEFAULT '',
  major      TEXT DEFAULT '',
  deadline   TEXT DEFAULT '',
  topic_idx  INTEGER,
  plan_stack TEXT DEFAULT '',
  def_scheme TEXT DEFAULT '',
  checks     TEXT DEFAULT '{}',
  invite_code TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  project_id TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  user_id    INTEGER,
  name       TEXT DEFAULT '',
  post       TEXT DEFAULT '技术',
  role       TEXT DEFAULT 'new',
  PRIMARY KEY (project_id, seq)
);

CREATE TABLE IF NOT EXISTS acts (
  project_id TEXT NOT NULL,
  act_id     TEXT NOT NULL,
  done       INTEGER DEFAULT 0,
  assignee   TEXT DEFAULT 'self',
  done_by    INTEGER,
  done_at    INTEGER,
  PRIMARY KEY (project_id, act_id)
);

CREATE TABLE IF NOT EXISTS project_users (
  project_id TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  role       TEXT DEFAULT 'member',
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id    INTEGER,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_p  ON members(project_id);
CREATE INDEX IF NOT EXISTS idx_acts_p     ON acts(project_id);
CREATE INDEX IF NOT EXISTS idx_feed_p     ON feed(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_pu_user    ON project_users(user_id);
`);

// ---- 小工具：把回调式改成直白一行
function get(sql, ...args) { return db.prepare(sql).get(...args); }
function all(sql, ...args) { return db.prepare(sql).all(...args); }
function run(sql, ...args) { return db.prepare(sql).run(...args); }

module.exports = { db, get, all, run, DATA_DIR };
