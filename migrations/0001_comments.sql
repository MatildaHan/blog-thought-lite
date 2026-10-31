CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id),
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comments_path_date ON comments(path, created_at DESC, id DESC);
CREATE TABLE comment_limits (
  key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX comment_limits_expiry ON comment_limits(expires_at);
