CREATE TABLE visual_sessions (
  session_id uuid PRIMARY KEY REFERENCES shopping_sessions(id) ON DELETE CASCADE,
  state jsonb NOT NULL
);
