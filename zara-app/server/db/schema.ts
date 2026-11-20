export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
ON messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (status IN ('unconfigured', 'pending_verification', 'ready', 'disabled')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  thread_id UNINDEXED,
  content,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_fts_insert
AFTER INSERT ON messages
BEGIN
  INSERT INTO messages_fts(message_id, thread_id, content)
  VALUES (new.id, new.thread_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete
AFTER DELETE ON messages
BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update
AFTER UPDATE OF content ON messages
BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
  INSERT INTO messages_fts(message_id, thread_id, content)
  VALUES (new.id, new.thread_id, new.content);
END;
`;
