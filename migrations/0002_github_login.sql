CREATE TABLE comment_users (
  github_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  homepage TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
ALTER TABLE comments ADD COLUMN user_id TEXT REFERENCES comment_users(github_id);
CREATE INDEX comments_user ON comments(user_id);
CREATE TABLE comment_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES comment_users(github_id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX comment_sessions_expiry ON comment_sessions(expires_at);
CREATE TABLE github_oauth_states (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  return_path TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX github_oauth_states_expiry ON github_oauth_states(expires_at);
