CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  accuracy REAL NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  sources JSONB NOT NULL,
  metadata JSONB,
  user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add any indexes you might need
CREATE INDEX chat_history_user_id_idx ON chat_history(user_id);
CREATE INDEX chat_history_created_at_idx ON chat_history(created_at DESC); 